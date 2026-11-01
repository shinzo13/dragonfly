from __future__ import annotations

from decimal import Decimal
from typing import Any

import httpx

from .api import Patch, Split, Tx


class FireflyError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"Firefly {status}: {message}")
        self.status = status


def _money(value: Decimal) -> str:
    return format(value.quantize(Decimal("0.000000000001")).normalize(), "f")


class Firefly:
    def __init__(self, url: str, token: str):
        self.http = httpx.Client(
            base_url=url.rstrip("/") + "/api",
            headers={"Accept": "application/json", "Authorization": f"Bearer {token}"},
            timeout=30,
        )

    def _call(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        response = self.http.request(method, path, **kwargs)
        if response.status_code >= 400:
            try:
                body = response.json()
                errors = body.get("errors") or {}
                message = next(iter(errors.values()))[0] if errors else body.get("message", response.text)
            except ValueError:
                message = response.text[:200]
            raise FireflyError(response.status_code, str(message))
        return response.json() if response.content else {}

    def get(self, path: str, **query: Any) -> dict[str, Any]:
        return self._call("GET", path, params=query)

    def all(self, path: str, **query: Any) -> list[dict[str, Any]]:
        page, out = 1, []
        while True:
            body = self.get(path, **query, page=page, limit=500)
            out.extend(body.get("data", []))
            pages = body.get("meta", {}).get("pagination", {}).get("total_pages", 1)
            if page >= pages:
                return out
            page += 1

    def currency_id(self, code: str) -> str:
        if not hasattr(self, "_currencies"):
            self._currencies = {c["attributes"]["code"]: c["id"] for c in self.all("/v1/currencies")}
        if code not in self._currencies:
            raise FireflyError(422, f"currency {code} is not in Firefly")
        return self._currencies[code]

    def account_balance(self, firefly_id: str) -> Decimal:
        attributes = self.get(f"/v1/accounts/{firefly_id}")["data"]["attributes"]
        return Decimal(attributes["current_balance"])

    def account_currency(self, firefly_id: str) -> str:
        return self.get(f"/v1/accounts/{firefly_id}")["data"]["attributes"]["currency_code"]

    def _splits(self, tx: Tx, account_id: str, splits: list[Split] | None = None) -> list[dict[str, Any]]:
        parts = splits if splits is not None else tx.splits
        if not parts:
            parts = [Split(amount=tx.amount, description=tx.description, category=tx.category, notes=tx.notes)]
        out = []
        for i, part in enumerate(parts):
            item: dict[str, Any] = {
                "amount": _money(part.amount),
                "category_name": part.category or tx.category,
                "currency_id": self.currency_id(tx.currency),
                "date": tx.booked.isoformat(),
                "description": part.description,
                "external_id": tx.external_id,
                "notes": part.notes if part.notes is not None else (tx.notes if i == 0 else None),
                "tags": part.tags or None,
                "type": "withdrawal" if tx.side == "debit" else "deposit",
            }
            if tx.side == "debit":
                item |= {"source_id": account_id, "destination_name": tx.payee}
            else:
                item |= {"destination_id": account_id, "source_name": tx.payee}
            if tx.foreign_amount is not None and tx.foreign_currency and len(parts) == 1:
                item |= {"foreign_amount": _money(tx.foreign_amount), "foreign_currency_id": self.currency_id(tx.foreign_currency)}
            out.append({k: v for k, v in item.items() if v is not None})
        return out

    def create(self, tx: Tx, account_id: str) -> str:
        body = {
            "apply_rules": True,
            "error_if_duplicate_hash": False,
            "group_title": tx.description if len(tx.splits) > 1 else None,
            "transactions": self._splits(tx, account_id),
        }
        return self._call("POST", "/v1/transactions", json={k: v for k, v in body.items() if v is not None})["data"]["id"]

    def attach(self, firefly_id: str, tx: Tx, account_id: str, move_date: bool) -> None:
        journals = self.journals(firefly_id)
        first = journals[0]
        if not tx.splits:
            if tx.notes:
                self._call("PUT", f"/v1/transactions/{firefly_id}", json={"transactions": [
                    {"transaction_journal_id": first["transaction_journal_id"], "notes": tx.notes}]})
            return
        parts = self._splits(tx, account_id)
        for i, part in enumerate(parts):
            part["external_id"] = first.get("external_id")
            part["date"] = tx.booked.isoformat() if move_date else first["date"]
            if tx.side == "debit":
                part["destination_name"] = first["destination_name"]
            else:
                part["source_name"] = first["source_name"]
            if i < len(journals):
                part["transaction_journal_id"] = journals[i]["transaction_journal_id"]
            part = {k: v for k, v in part.items() if v is not None}
            parts[i] = part
        body: dict[str, Any] = {"transactions": parts}
        if len(parts) > 1:
            body["group_title"] = tx.description
        self._call("PUT", f"/v1/transactions/{firefly_id}", json=body)

    def upload(self, firefly_id: str, attachments) -> None:
        if not attachments:
            return
        journal = self.journals(firefly_id)[0]["transaction_journal_id"]
        for item in attachments:
            meta = {"filename": item.filename, "attachable_type": "TransactionJournal", "attachable_id": str(journal)}
            attachment = self._call("POST", "/v1/attachments", json=meta)["data"]["id"]
            self._call(
                "POST",
                f"/v1/attachments/{attachment}/upload",
                content=item.content,
                headers={"Content-Type": "application/octet-stream"},
            )

    def journals(self, firefly_id: str) -> list[dict[str, Any]]:
        return self.get(f"/v1/transactions/{firefly_id}")["data"]["attributes"]["transactions"]

    def settle(self, firefly_id: str, final: Tx) -> None:
        single = len(self.journals(firefly_id)) == 1
        # the earlier date wins: a receipt or a block carries the purchase date, Erste books 1-4 days late
        fields: dict[str, Any] = {"external_id": final.external_id}
        if single:
            fields["amount"] = _money(final.amount)
            if final.foreign_amount is not None and final.foreign_currency:
                fields |= {"foreign_amount": _money(final.foreign_amount), "foreign_currency_id": self.currency_id(final.foreign_currency)}
        self._update_splits(firefly_id, lambda j: fields | {"date": min(j["date"][:10], final.booked.isoformat())})

    def patch(self, firefly_id: str, tx: Tx, account_id: str, patch: Patch) -> None:
        journals = self.journals(firefly_id)
        if patch.splits is not None:
            parts = self._splits(tx, account_id, patch.splits)
            for part, j in zip(parts, journals):
                part["transaction_journal_id"] = j["transaction_journal_id"]
            for part in parts:
                if patch.booked:
                    part["date"] = patch.booked.isoformat()
                if patch.budget:
                    part["budget_name"] = patch.budget
            body = {"group_title": patch.description or tx.description, "transactions": parts}
            self._call("PUT", f"/v1/transactions/{firefly_id}", json=body)
            return
        change = {
            "budget_name": patch.budget,
            "category_name": patch.category,
            "date": patch.booked.isoformat() if patch.booked else None,
            "description": patch.description,
            "notes": patch.notes,
            "tags": patch.tags,
        }
        change = {k: v for k, v in change.items() if v is not None}
        if not change:
            return
        body = {"transactions": [{"transaction_journal_id": j["transaction_journal_id"], **change} for j in journals]}
        self._call("PUT", f"/v1/transactions/{firefly_id}", json=body)

    def transfer(self, out_tx: Tx, out_id: str, into_tx: Tx, into_id: str, description: str, booked=None) -> str:
        item: dict[str, Any] = {
            "amount": _money(out_tx.amount),
            "currency_id": self.currency_id(out_tx.currency),
            "date": (booked or min(out_tx.booked, into_tx.booked)).isoformat(),
            "description": description,
            "destination_id": into_id,
            "external_id": f"{out_tx.external_id}+{into_tx.external_id}",
            "source_id": out_id,
            "type": "transfer",
        }
        if into_tx.currency != out_tx.currency:
            item |= {"foreign_amount": _money(into_tx.amount), "foreign_currency_id": self.currency_id(into_tx.currency)}
        body = {"apply_rules": False, "error_if_duplicate_hash": False, "transactions": [item]}
        return self._call("POST", "/v1/transactions", json=body)["data"]["id"]

    def set_rate(self, from_code: str, to_code: str, day, rate: Decimal) -> None:
        body = {"date": day.isoformat(), "from": from_code, "rate": _money(rate), "to": to_code}
        self._call("POST", "/v1/exchange-rates", json=body)

    def piggy_add(self, piggy_id: str, amount: Decimal) -> None:
        piggy = self.get(f"/v1/piggy-banks/{piggy_id}")["data"]["attributes"]
        slot = piggy["accounts"][0]
        current = Decimal(slot.get("current_amount") or "0")
        body = {"accounts": [{"account_id": slot["account_id"], "current_amount": _money(current + amount)}]}
        self._call("PUT", f"/v1/piggy-banks/{piggy_id}", json=body)

    def _update_splits(self, firefly_id: str, fields) -> None:
        group = self.get(f"/v1/transactions/{firefly_id}")["data"]["attributes"]
        parts = [{"transaction_journal_id": j["transaction_journal_id"]} | fields(j) for j in group["transactions"]]
        body: dict[str, Any] = {"transactions": parts}
        if len(parts) > 1:
            body["group_title"] = group.get("group_title") or group["transactions"][0]["description"]
        self._call("PUT", f"/v1/transactions/{firefly_id}", json=body)

    def set_budget(self, firefly_id: str, budget: str, journals: list[str] | None = None) -> None:
        wanted = None if journals is None else {str(j) for j in journals}
        self._update_splits(
            firefly_id,
            lambda j: {"budget_name": budget} if wanted is None or str(j["transaction_journal_id"]) in wanted else {},
        )

    def set_category(self, firefly_id: str, category: str) -> None:
        self._update_splits(firefly_id, lambda j: {"category_name": category})

    def reprice(self, firefly_id: str, tx) -> None:
        self._update_splits(
            firefly_id,
            lambda j: {"amount": _money(tx.amount), "date": tx.booked.isoformat(), "description": tx.description or tx.payee},
        )

    def delete(self, firefly_id: str) -> None:
        self._call("DELETE", f"/v1/transactions/{firefly_id}")
