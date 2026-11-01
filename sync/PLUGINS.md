# Firefly sync: plugin interface

Version 1, 2026-10-29. The code is the source of truth: `src/ffsync/api.py`. Nothing here is built yet.

## Pieces

- **core**: one Python service in its own container, in the same compose as Firefly. Owns the scheduler, deduplication, matching of provisional transactions, the question queue, the state database (`sqlite`) and the HTTP API the UI talks to. The only thing that writes to Firefly.
- **plugins**: folders with `manifest.toml` and `plugin.py`, in any directory the core is pointed at (`FFSYNC_PLUGINS`). Bank plugins live in a private repo, the core repo ships only `examples/`. `plugin.py` defines `plugin`, an instance with the methods of its kind. Four kinds: `source`, `matcher`, `enricher`, `hook`. Plugins never call the Firefly API to write; they return data and the core applies it.
- **UI**: the Sync tab. Talks to the core through `/sync/*`, proxied by the UI server.

## Manifest

```toml
id = "erste"                    # unique, [a-z0-9-]
name = "Erste Bank"
kind = "source"                 # source | matcher | enricher | hook
version = 1                     # interface version the plugin targets
icon = "landmark"               # lucide name, or a file next to the manifest: "logo.svg"

[schedule]
cron = "0 5 * * *"              # UTC; absent means: only when the core or a human starts it
after = []                      # ids that must finish first in the same run (matchers, hooks)
phase = "after"                 # hooks only: "before" runs ahead of the sources (exchange rates)

[budget]                        # source only
min_interval = "60s"

[match]                         # source only, see "Provisional transactions"
settle_days = 3                 # a final may arrive up to N days after its provisional
expire_days = 10                # unsettled provisional becomes a stale_provisional question
replace_provisional = false     # the provisional batch is the whole current set, see "Provisional transactions"
payee_prefix = "first_word"     # first_word | full | none
gap_tolerance = "0.01"          # balance gaps up to this are ignored; TON wants "0.000001"
lookback_days = 14              # matcher only: how far back `recent` reaches

[accounts]                      # source only: what this source feeds
erste = { firefly_id = "1", currency = "PLN" }

[[settings]]                    # rendered as a form in the UI
key = "consent_id"
label = "Consent"
type = "string"                 # string | secret | number | bool | file
required = true

[auth]                          # optional
type = "oauth_redirect"         # oauth_redirect | none
```

Secrets are stored by the core (files, mode 600, outside the plugin folder) and handed to the plugin through `ctx.secret(key)`. A plugin never reads its own files outside its folder.


## When the bank says 429

A source lets `httpx.HTTPStatusError` with status 429 reach the core (`raise_for_status()` does that) and does not retry on its own. The core ends this source's run at once, keeps its cursor and `last_ok`, so the next run reads the same window, and reports `rejected: true` with `retry_at`, the next try. With a `Retry-After` (seconds or a date) the scheduler leaves the source alone until it passes; without one the next scheduled run tries. `POST /sync/plugins/{id}/run` and `POST /sync/run` try once regardless of `Retry-After`; `min_interval` still applies to them. There is no daily request counter.

## Python interface

Plugins run in the core's own environment and may import only what `pyproject.toml` of the core lists (today: `httpx`, `pyjwt[crypto]`). A plugin that needs another package asks for it in the room; the core adds it.

```python
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Protocol

Side = Literal["debit", "credit"]          # money leaves / enters the account

@dataclass
class Split:
    amount: Decimal                         # positive, in the transaction currency
    description: str
    category: str | None = None
    tags: list[str] = field(default_factory=list)
    notes: str | None = None

@dataclass
class Tx:
    external_id: str                        # globally unique, prefixed: "erste:...", "mono:...", "receipt:..."
    account: str                            # key from [accounts]
    side: Side
    amount: Decimal                         # positive
    currency: str
    booked: date
    payee: str                              # counterparty as the bank shows it
    description: str
    foreign_amount: Decimal | None = None
    foreign_currency: str | None = None
    category: str | None = None
    splits: list[Split] = field(default_factory=list)   # empty means one split
    notes: str | None = None
    raw: dict = field(default_factory=dict)             # kept in core state for debugging, never sent to Firefly

@dataclass
class Balance:
    account: str
    amount: Decimal
    currency: str
    at: datetime

@dataclass
class Batch:
    final: list[Tx] = field(default_factory=list)
    provisional: list[Tx] = field(default_factory=list)   # pending blocks, receipts before the bank
    balances: list[Balance] = field(default_factory=list)
    cursor: str | None = None                              # opaque, handed back as ctx.cursor next time

class Context(Protocol):
    cursor: str | None                      # what the plugin returned last time
    since: date                             # core's suggestion: last successful run minus 3 days
    def secret(self, key: str) -> str: ...
    def setting(self, key: str): ...
    def log(self, message: str, **fields) -> None: ...
    def ask(self, question: "Question") -> None: ...
    firefly: "FireflyReader"                # read-only Firefly client

class Source(Protocol):
    def fetch(self, ctx: Context) -> Batch: ...
    def explain_gap(self, ctx: Context, account: str, gap: Decimal) -> list[Tx]: ...   # optional

class Auth(Protocol):                       # sources with [auth] type = "oauth_redirect"
    def start(self, ctx: Context, return_url: str) -> str: ...          # url to send the browser to
    def finish(self, ctx: Context, params: dict[str, str]) -> datetime: ...  # stores tokens via ctx, returns expiry

class Matcher(Protocol):                    # runs after all sources of a run
    def match(self, ctx: Context, fresh: list["Stored"], recent: list["Stored"]) -> list["Merge"]: ...

class Enricher(Protocol):                   # runs on every new or updated transaction
    def enrich(self, ctx: Context, tx: "Stored") -> "Patch | None": ...

class Hook(Protocol):                       # runs once at the end of a run
    def run(self, ctx: Context, report: "RunReport") -> None: ...
```

Hooks also get `ctx.write`, a narrow writer: `set_rate`, `piggy_add`, `set_budget(firefly_id, budget, journals=None)` (`journals`: only these `transaction_journal_id`s of the group, the other splits keep their budget). Every other kind gets `ctx.write = None`. `Patch` carries `category`, `tags`, `notes`, `splits`, `description`, `budget` (a budget name) and `booked` (moves the date, for receipts). The core resolves every currency code to a Firefly `currency_id`, so codes longer than three letters (GRAM) work. `ctx.since` is a hint; a source that needs its own window (Erste, 10 days) computes it from `ctx.cursor`.

`Stored` is a transaction as the core knows it after writing: the `Tx` fields plus `firefly_id` and `source`. `fresh` is what this run created; `recent` is what the core wrote in the last `lookback_days` (0 = none), not yet merged, read back from Firefly so manual edits show. Both halves of a transfer rarely land in one run (Erste books PayPal and Paysend 1-4 days late), so a matcher pairs `fresh` against `fresh + recent`. Groups older than the switch to the core are not in `recent`. A transaction used by two merges is merged once. `Merge` (with optional `booked`, else the earlier date of the two) tells the core to turn two stored withdrawals or deposits into one transfer (the `transfers.py` case: Erste to Paysend to Mono, two currencies). `Patch` changes fields of one stored transaction: category, splits, tags, notes. Exact field lists for `Stored`, `Merge`, `Patch`, `RunReport` and `Question` come with draft 2, after the core skeleton exists.


### Receipts

A provisional that is the same purchase as something already stored on that account is not created again; it is laid over the stored one. Two cases, checked in order: an open provisional of another source (same side and amount, payee by this source's `payee_prefix`, dates at most `settle_days` apart either way, the larger of the two sources), or a stored single-split booking dated `[booked, booked + settle_days of its source]` that carries nothing from this source yet. Its `splits`, `notes` and `attachments` go onto the stored transaction; payee and `external_id` stay; on a booking the date becomes the receipt date. Its `external_id` is remembered for that `firefly_id`, the report counts it as `settled`. When a booking settles a provisional, the earlier of the two dates wins.

`Tx.attachments: list[Attachment(filename, content: bytes)]` are uploaded to the first journal on create and on lay-over. `ctx.data` is the plugin's own writable folder (`data/plugins/<id>`). `ctx.resolve(key)` closes the plugin's own open question with that key, for questions the plugin answers itself (`receipts` once the receipt arrives). Question types: `category`, `receipts`, `receipt_items`, `stale_provisional`, `unexplained_gap`; the UI shows unknown ones with a Done button.

## What the core does with a batch

1. **Final**: skip if `external_id` was already written. Otherwise try to settle an open provisional, see below. Otherwise create a Firefly transaction with `external_id` set.
2. **Provisional**: create the Firefly transaction right away, so it counts in balances and budgets. Remember it as open.
3. **Balances**: compare with the Firefly balance of the mapped account. A gap above 0.01 goes to `explain_gap`; whatever it does not explain becomes an `unexplained_gap` question.
4. Enrichers run on everything that was created or changed, then matchers, then hooks.

## Provisional transactions

A final settles the oldest open provisional of the same source and account when:

- the amount is the same, compared as exact decimals;
- the side is the same;
- the payee matches by the `payee_prefix` rule;
- the final is booked from 0 to `settle_days` days after the provisional.

Settling updates the existing Firefly transaction (date, `external_id`, amount in the account currency) instead of creating a new one. A receipt that came before the bank is a provisional of the receipt source with the receipt's payee ("KAUFLAND 1029"). It is settled by the bank's final the same way, and its splits survive the update. A provisional still open after `expire_days` becomes a `stale_provisional` question.

With `replace_provisional = true` the source's provisional batch is its whole current set (Erste PSD2 gives no PDNG lines, only the hold total from `ITBD - ITAV`, sent as one provisional with a fixed `external_id`). An open provisional with the same `external_id` gets the new amount, date and description when they changed (counted as `settled`); an open provisional missing from the batch is deleted from Firefly, and its `external_id` may come back later as a new one. Such provisionals never settle against a final, nothing is laid over them, and they never go stale.

## Questions

One queue in the core, shown in the UI. Telegram only notifies, with a link into the UI.

| Type | Asked when | The answer becomes |
|---|---|---|
| `category` | an enricher cannot categorise a payee | a rule `payee -> category` in core state, applied to this and future transactions |
| `receipts` | a hook decides receipts are missing | nothing stored, closes when receipts arrive |
| `stale_provisional` | a provisional was not settled after `expire_days` | delete it, or keep it as final |
| `unexplained_gap` | a balance gap is left after `explain_gap` | a correcting transaction, or ignore |

`categories.py` today becomes the initial rule set.

## Core HTTP API (for the UI)

| Method | Path | Does |
|---|---|---|
| GET | `/sync/plugins` | manifests, status, last run, next run, auth expiry |
| POST | `/sync/plugins/{id}/run` | run one source now, refused with 429 inside `min_interval`, tried once even while the bank's `Retry-After` runs |
| POST | `/sync/run` | full run, like the scheduler |
| GET/PUT | `/sync/plugins/{id}/settings` | settings; secrets are write-only |
| POST | `/sync/plugins/{id}/auth/start` | returns the bank url; the UI sends the browser there |
| POST | `/sync/plugins/{id}/auth/finish` | the UI forwards the redirect params right away |
| GET | `/sync/runs?limit=` | run log with per-plugin results and errors |
| GET | `/sync/questions` | open questions |
| POST | `/sync/questions/{id}` | answer |

## Core state (sqlite)

`written(external_id, firefly_id, source, at)`, `provisional(firefly_id, source, account, side, amount, payee, booked, open)`, `runs(id, started, finished, ok, report_json)`, `rules(payee, category)`, `questions(id, type, payload_json, created, answered, answer_json)`, `cursors(source, cursor)`, `auth(source, expires_at)`.

## Switching from the old scripts

On the first run of a source the core seeds itself from Firefly: it reads the transactions of every account in `[accounts]` for the last `max(expire_days, 40)` days and remembers their `external_id`s. A source that changed its id format defines `legacy_ids(tx) -> list[str]` returning the old ids of a transaction (Mono: the bare operation id); the core skips a transaction when any of them is already in Firefly. Old pending blocks become open provisionals when their `external_id` starts with `[migrate] provisional_prefix` (`"pdng:"` for Erste), so the first real booking settles them instead of creating a twin. Groups without any `external_id` (transfers the old `transfers.py` merged, receipts `receipt.py` rewrote into splits) are remembered by account, side, group amount (sum of splits) and date. A bank line is skipped and linked to such a group when the group date lies in `[booked - settle_days, booked + 1 day]`; each group is used once. The cost: a genuinely new line with the same amount in that window is skipped too, so check the migration window by eye.

## Migration

Nothing on prod changes until approved. Order once approved:

1. The core skeleton runs against dev Firefly with plugins ported one by one, the cron sync on prod keeps running untouched.
2. Each ported plugin is checked against prod data read-only: same transactions as the old script would write, or the difference explained.
3. Switch over source by source; the old script for that source is disabled in the same step.
