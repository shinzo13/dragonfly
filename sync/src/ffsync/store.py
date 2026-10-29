from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Iterator

SCHEMA = """
create table if not exists written (
  external_id text primary key,
  firefly_id text not null,
  source text not null,
  at text not null
);
create table if not exists provisional (
  firefly_id text primary key,
  source text not null,
  account text not null,
  side text not null,
  amount text not null,
  payee text not null,
  booked text not null,
  external_id text not null,
  open integer not null default 1
);
create index if not exists provisional_open on provisional(source, account, open);
create table if not exists budget (
  source text not null,
  day text not null,
  used integer not null default 0,
  primary key (source, day)
);
create table if not exists runs (
  id integer primary key autoincrement,
  started text not null,
  finished text,
  ok integer,
  report text
);
create table if not exists rules (
  payee text primary key,
  category text not null
);
create table if not exists questions (
  id integer primary key autoincrement,
  source text not null,
  type text not null,
  key text,
  text text not null,
  payload text not null,
  created text not null,
  answered text,
  answer text
);
create unique index if not exists questions_open_key on questions(key) where answered is null and key is not null;
create table if not exists cursors (
  source text primary key,
  cursor text,
  last_run text,
  last_ok text
);
create table if not exists auth (
  source text primary key,
  expires_at text
);
create table if not exists settings (
  source text not null,
  key text not null,
  value text,
  primary key (source, key)
);
"""


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.execute("pragma journal_mode=wal")
        self.db.executescript(SCHEMA)
        self.lock = threading.RLock()

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        with self.lock:
            self.db.execute("begin")
            try:
                yield self.db
                self.db.execute("commit")
            except BaseException:
                self.db.execute("rollback")
                raise

    def one(self, sql: str, *args: Any) -> sqlite3.Row | None:
        with self.lock:
            return self.db.execute(sql, args).fetchone()

    def all(self, sql: str, *args: Any) -> list[sqlite3.Row]:
        with self.lock:
            return self.db.execute(sql, args).fetchall()

    def run(self, sql: str, *args: Any) -> int:
        with self.lock:
            return self.db.execute(sql, args).lastrowid or 0

    def written(self, external_id: str) -> str | None:
        row = self.one("select firefly_id from written where external_id = ?", external_id)
        return row["firefly_id"] if row else None

    def remember(self, external_id: str, firefly_id: str, source: str) -> None:
        self.run("insert or replace into written values (?, ?, ?, ?)", external_id, firefly_id, source, now())

    def used_today(self, source: str) -> int:
        row = self.one("select used from budget where source = ? and day = ?", source, date.today().isoformat())
        return row["used"] if row else 0

    def spend(self, source: str, n: int) -> None:
        self.run(
            "insert into budget values (?, ?, ?) on conflict(source, day) do update set used = used + excluded.used",
            source,
            date.today().isoformat(),
            n,
        )

    def cursor(self, source: str) -> sqlite3.Row | None:
        return self.one("select * from cursors where source = ?", source)

    def mark_run(self, source: str, ok: bool, cursor: str | None = None) -> None:
        stamp = now()
        self.run(
            """insert into cursors (source, cursor, last_run, last_ok) values (?, ?, ?, ?)
               on conflict(source) do update set
                 cursor = coalesce(excluded.cursor, cursors.cursor),
                 last_run = excluded.last_run,
                 last_ok = coalesce(excluded.last_ok, cursors.last_ok)""",
            source,
            cursor,
            stamp,
            stamp if ok else None,
        )

    def setting(self, source: str, key: str) -> str | None:
        row = self.one("select value from settings where source = ? and key = ?", source, key)
        return row["value"] if row else None

    def set_setting(self, source: str, key: str, value: Any) -> None:
        self.run("insert or replace into settings values (?, ?, ?)", source, key, json.dumps(value))

    def ask(self, source: str, type_: str, text: str, payload: dict[str, Any], key: str | None) -> bool:
        try:
            self.run(
                "insert into questions (source, type, key, text, payload, created) values (?, ?, ?, ?, ?, ?)",
                source,
                type_,
                key,
                text,
                json.dumps(payload, default=str),
                now(),
            )
        except sqlite3.IntegrityError:
            return False
        return True
