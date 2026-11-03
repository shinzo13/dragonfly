# receipts inside a blockade against dev Firefly: tagged when paid before the sync, taken off the lump, untagged when booked. Throwaway account.

import os
import sqlite3
import sys
import tempfile
import textwrap
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from ffsync.engine import Core
from ffsync.firefly import Firefly
from ffsync.store import Store

URL = "http://127.0.0.1:38090"
TOKEN = (Path(__file__).parent.parent / "data" / "firefly_token").read_text().strip()
ff = Firefly(URL, TOKEN)
acc = ff._call("POST", "/v1/accounts", json={
    "name": f"ffsync smoke blocked {date.today()}", "type": "asset", "account_role": "defaultAsset",
    "currency_code": "PLN", "opening_balance": "1000", "opening_balance_date": (date.today() - timedelta(days=20)).isoformat(),
})["data"]["id"]

tmp = Path(tempfile.mkdtemp())
plugins, data = tmp / "plugins", tmp / "data"
os.environ["SMOKE_STEP_FILE"] = str(tmp / "step")
for name, extra in (("bank", ""), ("shop", "")):
    (plugins / name).mkdir(parents=True)
    (plugins / name / "manifest.toml").write_text(textwrap.dedent(f"""
        id = "{name}"
        name = "{name}"
        kind = "source"
        [match]
        settle_days = 10
        payee_prefix = "first_word"
        [accounts]
        main = {{ firefly_id = "{acc}", currency = "PLN" }}
    """))
(plugins / "bank" / "plugin.py").write_text(textwrap.dedent("""
    import os
    from datetime import date
    from decimal import Decimal
    from ffsync.api import Batch, Blockade, Tx

    HELD = {1: "74.47", 2: "74.47", 3: "100", 4: "51.91", 5: "30", 6: None}

    class Bank:
        def fetch(self, ctx):
            s = int(open(os.environ["SMOKE_STEP_FILE"]).read())
            final = [Tx(external_id="bank:netto", account="main", side="debit", amount=Decimal("22.56"), currency="PLN",
                        booked=date.today(), payee="NETTO 12", description="NETTO 12")] if s >= 4 else []
            return Batch(final=final, blockades=[Blockade("main", Decimal(HELD[s]), "PLN")] if HELD[s] else [])

    plugin = Bank()
"""))
(plugins / "shop" / "plugin.py").write_text(textwrap.dedent("""
    import os
    from datetime import UTC, date, datetime, timedelta
    from decimal import Decimal
    from ffsync.api import Batch, Split, Tx

    def receipt(key, amount, payee, at, booked=None, splits=()):
        return Tx(external_id=f"receipt:{key}", account="main", side="debit", amount=Decimal(amount), currency="PLN",
                  booked=booked or date.today(), payee=payee, description=payee, at=at, splits=list(splits))

    class Shop:
        def fetch(self, ctx):
            s = int(open(os.environ["SMOKE_STEP_FILE"]).read())
            past = datetime.now(UTC) - timedelta(hours=1)
            out = [
                receipt("kaufland", "51.91", "KAUFLAND 1", past, splits=[
                    Split(amount=Decimal("40"), description="KAUFLAND: food", tags=["food"]),
                    Split(amount=Decimal("11.91"), description="KAUFLAND: home", tags=["home"]),
                ]),
                receipt("netto", "22.56", "NETTO 12", past - timedelta(minutes=5)),
            ]
            if s >= 2:
                out.append(receipt("later", "10", "LATER", datetime.now(UTC) + timedelta(hours=1)))
                out.append(receipt("today", "5", "NOTIME", None))
            return Batch(provisional=out)

    plugin = Shop()
"""))

core = Core(plugins, data, ff)
assert not core.errors, core.errors


def state():
    out = {}
    for g in ff.all(f"/v1/accounts/{acc}/transactions"):
        parts = g["attributes"]["transactions"]
        if parts[0]["type"] != "opening balance":
            out[parts[0]["description"].split(":")[0].split()[0]] = (
                sum(Decimal(p["amount"]) for p in parts), sorted({t for p in parts for t in p["tags"]})
            )
    return out


BLOCKED = "blockade-item"
ok = True
try:
    seen = {}
    for s in range(1, 7):
        (tmp / "step").write_text(str(s))
        report = core.run()
        assert all(r.ok for r in report.sources), report.sources
        seen[s] = (state(), ff.account_balance(acc))
        print("run", s, seen[s])
    def tagged(s, name):
        return BLOCKED in seen[s][0][name][1]
    checks = {
        "both receipts tagged, no lump": tagged(1, "KAUFLAND") and tagged(1, "NETTO") and "Blockades" not in seen[1][0],
        "split tags survive": seen[1][0]["KAUFLAND"][1] == [BLOCKED, "food", "home"],
        "balance counts each once": seen[1][1] == Decimal("925.53"),
        "paid after the sync is not blocked": not tagged(2, "LATER"),
        "no time today is not blocked": not tagged(2, "NOTIME"),
        "lump is the rest": seen[3][0]["Blockades"] == (Decimal("25.53"), ["blockade"]),
        "booked receipt loses the tag and keeps one row": seen[4][0]["NETTO"][1] == [] and seen[4][0]["NETTO"][0] == Decimal("22.56"),
        "closed sum leaves the lump": "Blockades" not in seen[4][0] and tagged(4, "KAUFLAND"),
        "too large for the rest stays plain, no negative": not tagged(5, "KAUFLAND") and seen[5][0]["Blockades"][0] == Decimal("30"),
        "nothing held clears all": not tagged(6, "KAUFLAND") and "Blockades" not in seen[6][0],
    }
    old = tmp / "old.sqlite"
    db = sqlite3.connect(old)
    db.executescript("""
        create table provisional (firefly_id text primary key, source text, account text, side text, amount text, payee text,
          booked text, external_id text, open integer not null default 1);
        create table blockades (source text not null, account text not null, firefly_id text not null, amount text not null,
          booked text not null, primary key (source, account));
        create table cursors (source text primary key, cursor text, last_run text, last_ok text);
        insert into blockades values ('bank', 'main', '625', '74.47', '2026-11-03');
        insert into cursors values ('bank', null, null, '2026-11-03T05:00:00+00:00');
    """)
    db.close()
    row = Store(old).one("select * from blockades")
    checks["old state migrates"] = row["held"] == "74.47" and row["at"] == "2026-11-03T05:00:00+00:00"
    for name, passed in checks.items():
        print("PASS" if passed else "FAIL", name)
        ok &= passed
finally:
    ff._call("DELETE", f"/v1/accounts/{acc}")
    print("test account deleted")
sys.exit(0 if ok else 1)
