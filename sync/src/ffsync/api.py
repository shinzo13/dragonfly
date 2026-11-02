"""The only module plugins import. Everything here is interface version 1."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal, Protocol

VERSION = 1

Side = Literal["debit", "credit"]
QuestionType = Literal["category", "receipts", "receipt_items", "stale_provisional", "unexplained_gap"]


class AuthExpired(Exception):
    """Raise from fetch() when the bank wants the user to log in again."""


@dataclass
class Split:
    amount: Decimal
    description: str
    category: str | None = None
    tags: list[str] = field(default_factory=list)
    notes: str | None = None


@dataclass
class Tx:
    external_id: str
    account: str
    side: Side
    amount: Decimal
    currency: str
    booked: date
    payee: str
    description: str
    foreign_amount: Decimal | None = None
    foreign_currency: str | None = None
    category: str | None = None
    splits: list[Split] = field(default_factory=list)
    notes: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)
    attachments: list[Attachment] = field(default_factory=list)


@dataclass
class Attachment:
    filename: str
    content: bytes


@dataclass
class Balance:
    account: str
    amount: Decimal
    currency: str
    at: datetime


@dataclass
class Blockade:
    """Money the bank holds on an account without saying what for, as one total per account."""

    account: str
    amount: Decimal
    currency: str


@dataclass
class Batch:
    final: list[Tx] = field(default_factory=list)
    provisional: list[Tx] = field(default_factory=list)
    balances: list[Balance] = field(default_factory=list)
    blockades: list[Blockade] = field(default_factory=list)
    cursor: str | None = None


@dataclass
class Stored:
    """A transaction as the core wrote it to Firefly."""

    tx: Tx
    source: str
    firefly_id: str
    provisional: bool


@dataclass
class Patch:
    """Changes an enricher wants on one stored transaction. None means: leave as is."""

    category: str | None = None
    tags: list[str] | None = None
    notes: str | None = None
    splits: list[Split] | None = None
    description: str | None = None
    budget: str | None = None
    booked: date | None = None


@dataclass
class Merge:
    """Two stored transactions that are one transfer between own accounts."""

    out: Stored
    into: Stored
    description: str | None = None
    booked: date | None = None


@dataclass
class Question:
    type: QuestionType
    text: str
    payload: dict[str, Any] = field(default_factory=dict)
    key: str | None = None


@dataclass
class SourceResult:
    source: str
    ok: bool
    created: int = 0
    settled: int = 0
    skipped: int = 0
    error: str | None = None
    rejected: bool = False
    retry_at: str | None = None


@dataclass
class RunReport:
    started: datetime
    sources: list[SourceResult] = field(default_factory=list)
    created: list[Stored] = field(default_factory=list)
    questions: int = 0


class FireflyReader(Protocol):
    def get(self, path: str, **query: Any) -> dict[str, Any]: ...
    def all(self, path: str, **query: Any) -> list[dict[str, Any]]: ...
    def account_balance(self, firefly_id: str) -> Decimal: ...


class FireflyWriter(Protocol):
    """Narrow writes for hooks. Transactions are still written only by the core."""

    def set_rate(self, from_code: str, to_code: str, day: date, rate: Decimal) -> None: ...
    def piggy_add(self, piggy_id: str, amount: Decimal) -> None: ...
    def set_budget(self, firefly_id: str, budget: str, journals: list[str] | None = None) -> None: ...


class Context(Protocol):
    plugin: str
    cursor: str | None
    since: date
    firefly: FireflyReader
    write: FireflyWriter | None
    data: Path  # the plugin's own writable folder

    def secret(self, key: str) -> str: ...
    def setting(self, key: str, default: Any = None) -> Any: ...
    def set_secret(self, key: str, value: str) -> None: ...
    def log(self, message: str, **fields: Any) -> None: ...
    def ask(self, question: Question) -> None: ...
    def resolve(self, key: str) -> None: ...  # closes the plugin's own open question with this key


class Source(Protocol):
    def fetch(self, ctx: Context) -> Batch: ...


class GapExplainer(Protocol):
    def explain_gap(self, ctx: Context, account: str, gap: Decimal) -> list[Tx]: ...


class Auth(Protocol):
    def start(self, ctx: Context, return_url: str) -> str: ...
    def finish(self, ctx: Context, params: dict[str, str]) -> datetime: ...


class Matcher(Protocol):
    def match(self, ctx: Context, fresh: list[Stored], recent: list[Stored]) -> list[Merge]: ...


class Enricher(Protocol):
    def enrich(self, ctx: Context, stored: Stored) -> Patch | None: ...


class Hook(Protocol):
    def run(self, ctx: Context, report: RunReport) -> None: ...
