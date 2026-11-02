# Plugins

A plugin teaches the sync core one thing: how to read a bank, categorise a transaction, pair two sides of a transfer, or do some chore around a run. Plugins never write transactions to Firefly. They return data, and the core handles scheduling, deduplication, matching and writing.

- [Quick start](#quick-start)
- [Kinds](#kinds)
- [Manifest](#manifest)
- [Context](#context)
- [Data types](#data-types)
- [How a run works](#how-a-run-works)
- [Provisional transactions](#provisional-transactions)
- [Receipts](#receipts)
- [Rate limits](#rate-limits)
- [Questions](#questions)
- [Bank login](#bank-login)
- [Switching from your own scripts](#switching-from-your-own-scripts)
- [HTTP API](#http-api)

## Quick start

A plugin is a folder inside the directory `FFSYNC_PLUGINS` points at:

```
plugins/
  mybank/
    manifest.toml
    plugin.py
```

`manifest.toml` describes it:

```toml
id = "mybank"
name = "My Bank"
kind = "source"
icon = "landmark"

[schedule]
cron = "0 5 * * *"

[accounts]
main = { firefly_id = "1", currency = "EUR" }

[[settings]]
key = "token"
label = "API token"
type = "secret"
required = true
```

`plugin.py` defines `plugin`, an instance with the methods of its kind:

```python
from datetime import date
from decimal import Decimal

import httpx

from ffsync.api import Batch, Context, Tx


class MyBank:
    def fetch(self, ctx: Context) -> Batch:
        response = httpx.get(
            "https://api.mybank.example/transactions",
            headers={"Authorization": f"Bearer {ctx.secret('token')}"},
            params={"from": ctx.since.isoformat()},
        )
        response.raise_for_status()
        return Batch(
            final=[
                Tx(
                    external_id=f"mybank:{item['id']}",
                    account="main",
                    side="debit" if item["amount"] < 0 else "credit",
                    amount=abs(Decimal(str(item["amount"]))),
                    currency="EUR",
                    booked=date.fromisoformat(item["date"]),
                    payee=item["counterparty"],
                    description=item["title"],
                )
                for item in response.json()
            ]
        )


plugin = MyBank()
```

To connect it, restart the core or call `POST /sync/reload`. The plugin appears in the Sync tab, where its settings are a form and a button runs it. Errors in a manifest are reported by `/sync/reload` and in the core's log.

A smaller working example is in [`sync/examples/hello`](../sync/examples/hello).

Plugins run in the core's own environment and can import only what [`sync/pyproject.toml`](../sync/pyproject.toml) lists. If you need another package, add it there. The only module of the core to import is `ffsync.api`.

## Kinds

| Kind | Method | Runs |
|---|---|---|
| `source` | `fetch(ctx) -> Batch` | on its cron, or from the button |
| `enricher` | `enrich(ctx, stored) -> Patch \| None` | on each transaction created in the run |
| `matcher` | `match(ctx, fresh, recent) -> list[Merge]` | once after the sources |
| `hook` | `run(ctx, report) -> None` | once at the end of a run, or at the start with `phase = "before"` |

### Source

Reads a bank and returns a `Batch`: `final` for booked transactions, `provisional` for pending ones and receipts, `balances` to check against Firefly, and `cursor`, which comes back as `ctx.cursor` next time.

`external_id` must be globally unique and stable, so prefix it with the plugin id. That id is what stops a transaction from being written twice.

A source may also define:

- `explain_gap(ctx, account, gap) -> list[Tx]` covers a difference between the bank's balance and Firefly's. Whatever stays unexplained becomes a question.
- `legacy_ids(tx) -> list[str]` see [Switching from your own scripts](#switching-from-your-own-scripts).

Raise `AuthExpired` from `fetch` when the bank wants the user to log in again.

### Enricher

Returns a `Patch` with the fields to change, or `None` to leave the transaction alone:

```python
from ffsync.api import Context, Patch, Stored


class Coffee:
    def enrich(self, ctx: Context, stored: Stored) -> Patch | None:
        if "coffee" in stored.tx.payee.lower():
            return Patch(category="Cafe", tags=["coffee"])
        return None


plugin = Coffee()
```

### Matcher

Turns two stored transactions into one transfer between your own accounts. `fresh` is what this run created. `recent` is what the core wrote in the last `lookback_days` and has not merged yet, read back from Firefly so manual edits show. Banks often book the two sides days apart, so pair `fresh` against `fresh + recent`:

```python
from ffsync.api import Context, Merge, Stored


class Transfers:
    def match(self, ctx: Context, fresh: list[Stored], recent: list[Stored]) -> list[Merge]:
        merges = []
        for out in fresh + recent:
            if out.tx.side != "debit":
                continue
            for into in fresh + recent:
                if into.tx.side == "credit" and into.tx.amount == out.tx.amount and into.tx.account != out.tx.account:
                    merges.append(Merge(out=out, into=into))
                    break
        return merges


plugin = Transfers()
```

A transaction used by two merges is merged once. The merged transfer gets the earlier date of the two unless `Merge.booked` says otherwise.

### Hook

The only kind with `ctx.write`, a narrow writer with `set_rate`, `piggy_add` and `set_budget`. Every other kind gets `ctx.write = None`.

```python
from datetime import date
from decimal import Decimal

from ffsync.api import Context, RunReport


class Rates:
    def run(self, ctx: Context, report: RunReport) -> None:
        ctx.write.set_rate("EUR", "USD", date.today(), Decimal("1.08"))


plugin = Rates()
```

Hooks also see the run so far: `report.sources` and `report.created`.

## Manifest

Only `id`, `name` and `kind` are required, and a source also needs `[accounts]`.

```toml
id = "mybank"                   # unique, [a-z0-9-]
name = "My Bank"
kind = "source"                 # source | matcher | enricher | hook
version = 1                     # interface version the plugin targets
icon = "landmark"               # lucide name, or a file next to the manifest: "logo.svg"

[schedule]
cron = "0 5 * * *"              # UTC; absent means only when started by hand
phase = "after"                 # hooks only: "before" runs ahead of the sources

[budget]                        # source only
min_interval = "60s"            # the core refuses to run it more often

[match]                         # see "Provisional transactions"
settle_days = 3                 # a final may arrive up to N days after its provisional
expire_days = 10                # an unsettled provisional becomes a question after this
replace_provisional = false     # the provisional batch is the whole current set
payee_prefix = "first_word"     # first_word | full | none
gap_tolerance = "0.01"          # balance gaps up to this are ignored
lookback_days = 14              # matcher only: how far back `recent` reaches, 0 means none

[accounts]                      # source only: key used in Tx.account -> Firefly account
main = { firefly_id = "1", currency = "EUR" }

[[settings]]                    # rendered as a form in the UI
key = "token"
label = "API token"
type = "secret"                 # string | secret | number | bool | file
required = true

[auth]
type = "oauth_redirect"         # oauth_redirect | none, see "Bank login"

[migrate]
provisional_prefix = "pending:" # see "Switching from your own scripts"
```

Secrets are stored by the core in files with mode 600, outside the plugin's folder, and are write-only from the UI.

## Context

Every method gets `ctx`:

| Member | What it is |
|---|---|
| `ctx.plugin` | this plugin's id |
| `ctx.cursor` | what the source returned last time |
| `ctx.since` | a suggested start date: the last successful run minus 3 days, or 33 days back on the first run. A source that needs its own window works it out from `ctx.cursor` |
| `ctx.secret(key)` | a secret; raises `KeyError` if it is not set |
| `ctx.set_secret(key, value)` | stores a secret, such as a refreshed token |
| `ctx.setting(key, default=None)` | a value from the settings form |
| `ctx.data` | the plugin's own writable folder |
| `ctx.log(message, **fields)` | writes to the core's log |
| `ctx.ask(question)` | adds a [question](#questions) for the user |
| `ctx.resolve(key)` | closes this plugin's open question with that key |
| `ctx.firefly` | read-only client: `get(path, **query)`, `all(path, **query)`, `account_balance(firefly_id)` |
| `ctx.write` | writer for hooks, `None` otherwise |

## Data types

All of them are in `ffsync.api`.

`Tx` is one transaction. `amount` is always positive and `side` says the direction: `debit` leaves the account, `credit` enters it.

| Field | |
|---|---|
| `external_id`, `account`, `side`, `amount`, `currency`, `booked`, `payee`, `description` | required |
| `foreign_amount`, `foreign_currency` | the amount in another currency |
| `category`, `notes` | optional |
| `splits` | `list[Split]`, empty means one split |
| `attachments` | `list[Attachment(filename, content)]`, uploaded to the first split |
| `raw` | kept for debugging, never sent to Firefly |

Currency codes longer than three letters work: the core resolves each one to a Firefly `currency_id`.

- `Split`: `amount`, `description`, `category`, `tags`, `notes`.
- `Balance`: `account`, `amount`, `currency`, `at`.
- `Blockade`: `account`, `amount`, `currency`.
- `Batch`: `final`, `provisional`, `balances`, `blockades`, `cursor`.
- `Stored`: `tx`, `source`, `firefly_id`, `provisional`. A transaction as the core wrote it.
- `Patch`: `category`, `tags`, `notes`, `splits`, `description`, `budget`, `booked`. `None` leaves a field as it is.
- `Merge`: `out`, `into`, `description`, `booked`.
- `Question`: `type`, `text`, `payload`, `key`.
- `RunReport`: `started`, `sources`, `created`, `questions`.

## How a run works

1. Hooks with `phase = "before"`.
2. Sources. On a source's first run the core first [learns what is already in Firefly](#switching-from-your-own-scripts).
3. Enrichers on everything created, then matchers.
4. Provisionals past `expire_days` become questions.
5. The other hooks.

Only one run goes at a time. A failing plugin is reported and does not stop the others.

For each batch:

- **Final:** skipped if its `external_id` is known. Otherwise it settles an open provisional, or becomes a new Firefly transaction.
- **Provisional:** created in Firefly right away, so it counts in balances and budgets, and remembered as open.
- **Balances:** compared with Firefly. A gap above `gap_tolerance` goes to `explain_gap`, and what stays unexplained becomes a question.

## Provisional transactions

A final settles the oldest open provisional of the same source and account when:

- the amount is exactly the same;
- the side is the same;
- the payee matches by the `payee_prefix` rule;
- the final is booked 0 to `settle_days` days after the provisional.

Settling updates the existing Firefly transaction with the date, `external_id` and amount instead of creating a new one, and its splits survive. When a booking settles a provisional, the earlier date wins. A provisional still open after `expire_days` becomes a `stale_provisional` question.

With `replace_provisional = true`, the batch is the source's whole current set. Use this when a bank gives only a total of its holds, sent as one provisional with a fixed `external_id`. An open provisional with the same id is updated when it changed, and one missing from the batch is deleted from Firefly. These provisionals never settle against a final, nothing is laid over them, and they never go stale.

## Blockades

Some banks report how much money is held on an account but not what it was spent on. Return that as one total per account:

```python
Batch(final=final, blockades=[Blockade(account="main", amount=held, currency="PLN")])
```

The core keeps one Firefly withdrawal per account, dated today and tagged `blockade`, so balances and spending stay right. `blockades` is the source's whole current set: a changed amount updates the transaction, and an account missing from the batch has its transaction deleted. The UI leaves these transactions out of lists and category breakdowns and shows their sum separately. With no blockades, nothing is shown.

## Receipts

A provisional that is the same purchase as something already stored on that account is laid over it instead of being created again. Two cases, checked in order:

1. An open provisional of another source: same side and amount, payee by this source's `payee_prefix`, dates at most `settle_days` apart either way.
2. A stored single-split booking dated within `settle_days` after the receipt that carries nothing from this source yet.

Its `splits`, `notes` and `attachments` go onto the stored transaction, while the payee and `external_id` stay. On a booking the date becomes the receipt's date. The report counts it as `settled`.

## Rate limits

Let a 429 reach the core, which `raise_for_status()` does, and do not retry on your own. The core ends the source's run, keeps its cursor, so the next run reads the same window, and reports `rejected` with `retry_at`.

With a `Retry-After` header the scheduler leaves the source alone until it passes. Without one, the next scheduled run tries. The button always tries once, but `min_interval` still applies to it. There is no daily request counter.

## Questions

Things only a person can decide go into one queue, shown in the Sync tab.

```python
from ffsync.api import Question

question = Question(type="category", text="Which category is ACME?", payload={"payee": "ACME"}, key="acme")
```

| Type | Answer |
|---|---|
| `category` | adds a rule `payee -> category`, which applies to this and future transactions |
| `stale_provisional` | `{"action": "delete"}` deletes it, anything else keeps it as final |
| `receipts`, `receipt_items`, `unexplained_gap` | closes the question |

The UI shows unknown types with a Done button. A plugin can close its own question with `ctx.resolve(key)`, for example once the missing receipt arrives.

## Bank login

For a source with `[auth] type = "oauth_redirect"`, define two more methods:

```python
from datetime import UTC, datetime, timedelta

from ffsync.api import Context, Batch


class MyBank:
    def start(self, ctx: Context, return_url: str) -> str:
        return f"https://bank.example/authorize?redirect_uri={return_url}"

    def finish(self, ctx: Context, params: dict[str, str]) -> datetime:
        ctx.set_secret("refresh_token", params["code"])
        return datetime.now(UTC) + timedelta(days=90)

    def fetch(self, ctx: Context) -> Batch:
        return Batch()


plugin = MyBank()
```

`start` returns the URL to send the browser to. `finish` gets the parameters of the redirect, stores the tokens and returns when the login expires, and the Sync tab shows that date.

## Switching from your own scripts

On a source's first run the core reads the transactions of every account in `[accounts]` for the last `max(expire_days, 40)` days and remembers their `external_id`s, so nothing is written twice.

- If your ids changed format, define `legacy_ids(tx) -> list[str]` with the old ids of a transaction. The core skips it when any of them is already in Firefly.
- Old pending transactions become open provisionals when their `external_id` starts with `provisional_prefix`, so the first real booking settles them.
- Groups without any `external_id` are remembered by account, side, amount and date. A bank line is skipped and linked to such a group when the group's date lies from `settle_days` before the booking to one day after it, and each group is used once.

That last rule has a cost: a genuinely new line with the same amount in that window is skipped too, so check the first run by eye.

## HTTP API

The UI talks to the core through these. The core has no auth of its own, so keep them behind your proxy's.

| Method | Path | Does |
|---|---|---|
| GET | `/sync/plugins` | manifests, status, last and next run, login expiry |
| POST | `/sync/plugins/{id}/run` | runs one source; refused with 429 inside `min_interval` |
| POST | `/sync/run` | a full run, like the scheduler |
| GET/PUT | `/sync/plugins/{id}/settings` | settings; secrets are write-only |
| POST | `/sync/plugins/{id}/auth/start` | returns the bank's URL |
| POST | `/sync/plugins/{id}/auth/finish` | forwards the redirect parameters |
| GET | `/sync/runs?limit=` | run log with per-plugin results and errors |
| GET | `/sync/questions` | open questions |
| POST | `/sync/questions/{id}` | answers one |
| POST | `/sync/reload` | reads the plugins folder again |
