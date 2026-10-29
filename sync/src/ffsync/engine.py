from __future__ import annotations

import json
import logging
import os
import re
import threading
import traceback
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from .api import (
    AuthExpired,
    Balance,
    Batch,
    BudgetExhausted,
    Patch,
    Question,
    RunReport,
    SourceResult,
    Stored,
    Tx,
)
from .firefly import Firefly, FireflyError
from .manifest import Manifest, discover, load_module
from .store import Store, now

log = logging.getLogger("ffsync")
WORD = re.compile(r"[\w']+", re.UNICODE)
GAP_TOLERANCE = Decimal("0.01")
LOOKBACK_DAYS = 3


def payee_key(payee: str, rule: str) -> str:
    text = payee.strip().lower()
    if rule == "none":
        return ""
    if rule == "first_word":
        words = WORD.findall(text)
        return words[0] if words else ""
    return text


class Ctx:
    def __init__(self, core: Core, manifest: Manifest):
        self.core = core
        self.manifest = manifest
        self.plugin = manifest.id
        row = core.store.cursor(manifest.id)
        self.cursor = row["cursor"] if row else None
        last_ok = row["last_ok"] if row and row["last_ok"] else None
        start = datetime.fromisoformat(last_ok).date() if last_ok else date.today() - timedelta(days=30)
        self.since = start - timedelta(days=LOOKBACK_DAYS)
        self.firefly = core.firefly
        self.write = core.firefly if manifest.kind == "hook" else None
        self.asked = 0

    def secret(self, key: str) -> str:
        path = self.core.secret_path(self.plugin, key)
        if not path.exists():
            raise KeyError(f"{self.plugin}: secret {key} is not set")
        return path.read_text().strip()

    def set_secret(self, key: str, value: str) -> None:
        self.core.write_secret(self.plugin, key, value)

    def setting(self, key: str, default: Any = None) -> Any:
        raw = self.core.store.setting(self.plugin, key)
        return json.loads(raw) if raw is not None else default

    def spend(self, n: int = 1) -> None:
        limit = self.manifest.requests_per_day
        if limit is not None and self.core.store.used_today(self.plugin) + n > limit:
            raise BudgetExhausted(f"{self.plugin}: {limit} requests a day are spent")
        self.core.store.spend(self.plugin, n)

    def log(self, message: str, **fields: Any) -> None:
        log.info("[%s] %s %s", self.plugin, message, fields or "")

    def ask(self, question: Question) -> None:
        if self.core.store.ask(self.plugin, question.type, question.text, question.payload, question.key):
            self.asked += 1


class Core:
    def __init__(self, plugins: Path, data: Path, firefly: Firefly):
        self.plugins_dir = plugins
        self.data = data
        self.firefly = firefly
        self.store = Store(data / "state.sqlite")
        self.run_lock = threading.Lock()
        self.reload()

    def reload(self) -> None:
        self.manifests, self.errors = discover(self.plugins_dir)
        self.modules: dict[str, Any] = {}
        for manifest in list(self.manifests):
            try:
                self.modules[manifest.id] = load_module(manifest).plugin
            except Exception as error:
                self.errors.append(f"{manifest.id}: {error}")
                self.manifests.remove(manifest)

    def manifest(self, plugin_id: str) -> Manifest | None:
        return next((m for m in self.manifests if m.id == plugin_id), None)

    def of_kind(self, kind: str) -> list[Manifest]:
        return [m for m in self.manifests if m.kind == kind]

    def secret_path(self, plugin: str, key: str) -> Path:
        return self.data / "secrets" / plugin / key

    def write_secret(self, plugin: str, key: str, value: str) -> None:
        path = self.secret_path(plugin, key)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        path.write_text(value)
        os.chmod(path, 0o600)

    def run_ready(self, manifest: Manifest) -> str | None:
        """Why a source cannot run right now, or None."""
        limit = manifest.requests_per_day
        if limit is not None and self.store.used_today(manifest.id) >= limit:
            return f"{limit} requests a day are spent"
        row = self.store.cursor(manifest.id)
        if manifest.min_interval and row and row["last_run"]:
            wait = datetime.fromisoformat(row["last_run"]) + timedelta(seconds=manifest.min_interval) - datetime.now(UTC)
            if wait.total_seconds() > 0:
                return f"wait {int(wait.total_seconds())} s more"
        return None

    def run(self, only: list[str] | None = None) -> RunReport:
        if not self.run_lock.acquire(blocking=False):
            raise RuntimeError("a run is already going")
        try:
            return self._run(only)
        finally:
            self.run_lock.release()

    def _run(self, only: list[str] | None) -> RunReport:
        report = RunReport(started=datetime.now(UTC))
        run_id = self.store.run("insert into runs (started) values (?)", now())
        for manifest in self.of_kind("hook"):
            if manifest.phase == "before":
                try:
                    self.modules[manifest.id].run(Ctx(self, manifest), report)
                except Exception as error:
                    report.sources.append(SourceResult(source=manifest.id, ok=False, error=str(error)))
        sources = [m for m in self.of_kind("source") if only is None or m.id in only]
        for manifest in sources:
            report.sources.append(self._source(manifest, report))
        if report.created:
            self._enrich(report.created)
            self._match(report.created)
        self._expire()
        for manifest in self.of_kind("hook"):
            if manifest.phase == "before":
                continue
            try:
                self.modules[manifest.id].run(Ctx(self, manifest), report)
            except Exception as error:
                report.sources.append(SourceResult(source=manifest.id, ok=False, error=str(error)))
        report.questions = len(self.store.all("select id from questions where answered is null"))
        ok = all(s.ok for s in report.sources)
        self.store.run(
            "update runs set finished = ?, ok = ?, report = ? where id = ?",
            now(),
            int(ok),
            json.dumps(
                {
                    "sources": [asdict(s) for s in report.sources],
                    "created": len(report.created),
                    "questions": report.questions,
                }
            ),
            run_id,
        )
        return report

    def _source(self, manifest: Manifest, report: RunReport) -> SourceResult:
        result = SourceResult(source=manifest.id, ok=True)
        blocked = self.run_ready(manifest)
        if blocked:
            return SourceResult(source=manifest.id, ok=False, error=blocked)
        ctx = Ctx(self, manifest)
        try:
            batch: Batch = self.modules[manifest.id].fetch(ctx)
            for tx in batch.final:
                self._final(manifest, tx, result, report)
            for tx in batch.provisional:
                self._provisional(manifest, tx, result, report)
            for balance in batch.balances:
                self._balance(manifest, ctx, balance, result, report)
            self.store.mark_run(manifest.id, True, batch.cursor)
        except (BudgetExhausted, AuthExpired, FireflyError, Exception) as error:
            result.ok = False
            result.error = f"{type(error).__name__}: {error}"
            log.warning("[%s] %s", manifest.id, traceback.format_exc())
            self.store.mark_run(manifest.id, False)
            if isinstance(error, AuthExpired):
                self.store.run("insert or replace into auth values (?, ?)", manifest.id, now())
        return result

    def _account(self, manifest: Manifest, key: str) -> str:
        account = manifest.accounts.get(key)
        if not account:
            raise KeyError(f"{manifest.id}: account {key} is not in the manifest")
        return account["firefly_id"]

    def _with_rules(self, tx: Tx) -> Tx:
        if tx.category or tx.splits:
            return tx
        row = self.store.one("select category from rules where payee = ?", payee_key(tx.payee, "full"))
        if row:
            tx.category = row["category"]
        return tx

    def _final(self, manifest: Manifest, tx: Tx, result: SourceResult, report: RunReport) -> None:
        if self.store.written(tx.external_id):
            result.skipped += 1
            return
        open_one = self._find_provisional(manifest, tx)
        if open_one:
            self.firefly.settle(open_one["firefly_id"], tx)
            with self.store.tx() as db:
                db.execute("update provisional set open = 0 where firefly_id = ?", (open_one["firefly_id"],))
                db.execute(
                    "insert or replace into written values (?, ?, ?, ?)",
                    (tx.external_id, open_one["firefly_id"], manifest.id, now()),
                )
            result.settled += 1
            return
        firefly_id = self.firefly.create(self._with_rules(tx), self._account(manifest, tx.account))
        self.store.remember(tx.external_id, firefly_id, manifest.id)
        report.created.append(Stored(tx=tx, source=manifest.id, firefly_id=firefly_id, provisional=False))
        result.created += 1

    def _find_provisional(self, manifest: Manifest, tx: Tx):
        candidates = self.store.all(
            """select * from provisional
               where open = 1 and account = ? and side = ? and amount = ?
               order by booked, rowid""",
            self._account(manifest, tx.account),
            tx.side,
            str(tx.amount.normalize()),
        )
        key = payee_key(tx.payee, manifest.payee_prefix)
        for row in candidates:
            booked = date.fromisoformat(row["booked"])
            if not (booked <= tx.booked <= booked + timedelta(days=manifest.settle_days)):
                continue
            if manifest.payee_prefix != "none" and payee_key(row["payee"], manifest.payee_prefix) != key:
                continue
            return row
        return None

    def _provisional(self, manifest: Manifest, tx: Tx, result: SourceResult, report: RunReport) -> None:
        if self.store.written(tx.external_id):
            result.skipped += 1
            return
        account_id = self._account(manifest, tx.account)
        firefly_id = self.firefly.create(self._with_rules(tx), account_id)
        with self.store.tx() as db:
            db.execute(
                "insert or replace into written values (?, ?, ?, ?)", (tx.external_id, firefly_id, manifest.id, now())
            )
            db.execute(
                "insert or replace into provisional values (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                (
                    firefly_id,
                    manifest.id,
                    account_id,
                    tx.side,
                    str(tx.amount.normalize()),
                    tx.payee,
                    tx.booked.isoformat(),
                    tx.external_id,
                ),
            )
        report.created.append(Stored(tx=tx, source=manifest.id, firefly_id=firefly_id, provisional=True))
        result.created += 1

    def _balance(self, manifest: Manifest, ctx: Ctx, balance: Balance, result: SourceResult, report: RunReport) -> None:
        account_id = self._account(manifest, balance.account)
        gap = balance.amount - self.firefly.account_balance(account_id)
        if abs(gap) <= GAP_TOLERANCE:
            return
        explainer = getattr(self.modules[manifest.id], "explain_gap", None)
        if explainer:
            for tx in explainer(ctx, balance.account, gap):
                self._final(manifest, tx, result, report)
            gap = balance.amount - self.firefly.account_balance(account_id)
        if abs(gap) > GAP_TOLERANCE:
            self.store.ask(
                manifest.id,
                "unexplained_gap",
                f"{manifest.name}: the bank says {balance.amount} {balance.currency}, Firefly is off by {gap}",
                {"account": balance.account, "firefly_id": account_id, "gap": str(gap), "currency": balance.currency},
                f"gap:{account_id}",
            )

    def _enrich(self, created: list[Stored]) -> None:
        for manifest in self.of_kind("enricher"):
            ctx = Ctx(self, manifest)
            for stored in created:
                try:
                    patch: Patch | None = self.modules[manifest.id].enrich(ctx, stored)
                    if patch:
                        owner = self.manifest(stored.source)
                        account = self._account(owner, stored.tx.account) if owner else ""
                        self.firefly.patch(stored.firefly_id, stored.tx, account, patch)
                except Exception:
                    log.warning("[%s] %s", manifest.id, traceback.format_exc())

    def _match(self, created: list[Stored]) -> None:
        for manifest in self.of_kind("matcher"):
            ctx = Ctx(self, manifest)
            try:
                merges = self.modules[manifest.id].match(ctx, created)
            except Exception:
                log.warning("[%s] %s", manifest.id, traceback.format_exc())
                continue
            for merge in merges:
                out_m, in_m = self.manifest(merge.out.source), self.manifest(merge.into.source)
                if not out_m or not in_m:
                    continue
                description = merge.description or f"{merge.out.tx.payee} → {merge.into.tx.payee}"
                new_id = self.firefly.transfer(
                    merge.out.tx,
                    self._account(out_m, merge.out.tx.account),
                    merge.into.tx,
                    self._account(in_m, merge.into.tx.account),
                    description,
                )
                for part in (merge.out, merge.into):
                    self.firefly.delete(part.firefly_id)
                    self.store.remember(part.tx.external_id, new_id, part.source)

    def _expire(self) -> None:
        for manifest in self.of_kind("source"):
            limit = (date.today() - timedelta(days=manifest.expire_days)).isoformat()
            for row in self.store.all(
                "select * from provisional where open = 1 and source = ? and booked < ?", manifest.id, limit
            ):
                self.store.ask(
                    manifest.id,
                    "stale_provisional",
                    f"{row['payee']} {row['amount']} from {row['booked']} never cleared. Delete it?",
                    {"firefly_id": row["firefly_id"], "payee": row["payee"], "amount": row["amount"], "booked": row["booked"]},
                    f"stale:{row['firefly_id']}",
                )

    def answer(self, question_id: int, answer: dict[str, Any]) -> None:
        row = self.store.one("select * from questions where id = ?", question_id)
        if not row or row["answered"]:
            raise KeyError("no such open question")
        payload = json.loads(row["payload"])
        kind = row["type"]
        if kind == "category":
            category = str(answer["category"]).strip()
            self.store.run("insert or replace into rules values (?, ?)", payee_key(payload["payee"], "full"), category)
            if payload.get("firefly_id"):
                self.firefly.set_category(payload["firefly_id"], category)
        elif kind == "stale_provisional":
            if answer.get("action") == "delete":
                self.firefly.delete(payload["firefly_id"])
            self.store.run("update provisional set open = 0 where firefly_id = ?", payload["firefly_id"])
        self.store.run(
            "update questions set answered = ?, answer = ? where id = ?", now(), json.dumps(answer), question_id
        )
