"""Receipts against dev Firefly: a receipt laid over a booking, over a block, a block over a receipt. Throwaway account."""

import os
import sys
import tempfile
import textwrap
from datetime import date, timedelta
from pathlib import Path

from ffsync.engine import Core
from ffsync.firefly import Firefly

URL = "http://127.0.0.1:38090"
TOKEN = (Path(__file__).parent.parent / "data" / "firefly_token").read_text().strip()
ff = Firefly(URL, TOKEN)
acc = ff._call("POST", "/v1/accounts", json={
    "name": f"ffsync smoke receipts {date.today()}", "type": "asset", "account_role": "defaultAsset",
    "currency_code": "PLN", "opening_balance": "100", "opening_balance_date": (date.today() - timedelta(days=20)).isoformat(),
})["data"]["id"]

tmp = Path(tempfile.mkdtemp())
plugins, data = tmp / "plugins", tmp / "data"
os.environ["SMOKE_STEP_FILE"] = str(tmp / "step")
for pid, settle, prefix in (("bank", 10, "pdng:"), ("receipts", 3, "")):
    (plugins / pid).mkdir(parents=True)
    (plugins / pid / "manifest.toml").write_text(textwrap.dedent(f"""
        id = "{pid}"
        name = "{pid}"
        kind = "source"
        [match]
        settle_days = {settle}
        [migrate]
        provisional_prefix = "{prefix}"
        [accounts]
        main = {{ firefly_id = "{acc}", currency = "PLN" }}
    """))
common = textwrap.dedent("""
    import os
    from datetime import date, timedelta
    from decimal import Decimal
    from ffsync.api import Attachment, Batch, Question, Split, Tx

    def step():
        return int(open(os.environ["SMOKE_STEP_FILE"]).read())

    def days(n):
        return date.today() - timedelta(days=n)

    def tx(eid, amount, ago, payee, splits=(), **kw):
        return Tx(external_id=eid, account="main", side="debit", amount=Decimal(amount), currency="PLN", booked=days(ago),
                  payee=payee, description=payee, splits=[Split(amount=Decimal(a), description=d) for a, d in splits], **kw)
""")
(plugins / "bank" / "plugin.py").write_text(common + textwrap.dedent("""
    BANK = "KAUFLAND 1029 POZNAN"

    class Bank:
        def fetch(self, ctx):
            s = step()
            final, provisional = [], []
            if s == 1:
                final = [tx("bank:1", "20", 2, BANK)]
                provisional = [tx("pdng:3", "9", 1, BANK)]
            if s == 2:
                provisional = [tx("pdng:2", "15", 1, BANK)]
            if s == 3:
                final = [tx("bank:2", "15", 0, BANK), tx("bank:3", "9", 0, BANK)]
            return Batch(final=final, provisional=provisional)

    plugin = Bank()
"""))
(plugins / "receipts" / "plugin.py").write_text(common + textwrap.dedent("""
    class Receipts:
        def fetch(self, ctx):
            s = step()
            (ctx.data / f"step{s}").write_text("seen")
            if s == 1:
                ctx.ask(Question(type="receipts", text="food without a receipt", key="r:1"))
                return Batch(provisional=[tx("rcpt:2", "15", 1, "KAUFLAND 1029", [("5", "bread"), ("10", "cheese")])])
            if s == 2:
                ctx.resolve("r:1")
                return Batch(provisional=[
                    tx("rcpt:1", "20", 4, "KAUFLAND 1029", [("8", "milk"), ("12", "eggs")], notes="receipt 1",
                       attachments=[Attachment(filename="r1.txt", content=b"KAUFLAND receipt 1")]),
                    tx("rcpt:3", "9", 1, "KAUFLAND 1029", [("4", "soap"), ("5", "tea")]),
                ])
            return Batch()

    plugin = Receipts()
"""))

core = Core(plugins, data, ff)
assert not core.errors, core.errors
ok = True
try:
    results = []
    for s in (1, 2, 3):
        (tmp / "step").write_text(str(s))
        report = core.run()
        results.append({r.source: r for r in report.sources})
        print("run", s, [vars(r) for r in report.sources])
    groups = {}
    for g in ff.all(f"/v1/accounts/{acc}/transactions"):
        parts = g["attributes"]["transactions"]
        if parts[0]["type"] == "opening balance":
            continue
        groups[parts[0]["external_id"]] = (g["id"], parts)
    for eid, (gid, parts) in groups.items():
        print(eid, parts[0]["date"][:10], parts[0]["destination_name"], [(p["description"], p["amount"][:5]) for p in parts])
    att = ff.all(f"/v1/transactions/{groups['bank:1'][0]}/attachments") if "bank:1" in groups else []
    print("notes", [p["notes"] for p in groups["bank:1"][1]], "attachments", len(att))
    q = core.store.one("select answered, answer from questions where key = 'r:1'")
    checks = {
        "three groups, no twins": sorted(groups) == ["bank:1", "bank:2", "bank:3"],
        "receipt over booking: splits": sorted(p["description"] for p in groups["bank:1"][1]) == ["eggs", "milk"],
        "receipt over booking: receipt date, bank payee": groups["bank:1"][1][0]["date"][:10] == (date.today() - timedelta(days=4)).isoformat()
        and groups["bank:1"][1][0]["destination_name"] == "KAUFLAND 1029 POZNAN",
        "receipt over booking: notes and attachment": any(p["notes"] == "receipt 1" for p in groups["bank:1"][1]) and len(att) == 1,
        "block over receipt kept splits, booking settled it": len(groups["bank:2"][1]) == 2,
        "receipt over block, booking settled it": sorted(p["description"] for p in groups["bank:3"][1]) == ["soap", "tea"],
        "run2: receipts settled 2, bank settled 1": results[1]["receipts"].settled == 2 and results[1]["bank"].settled == 1
        and results[1]["bank"].created == 0 and results[1]["receipts"].created == 0,
        "booking keeps the earlier receipt date": groups["bank:2"][1][0]["date"][:10] == (date.today() - timedelta(days=1)).isoformat(),
        "run3: two bookings settled": results[2]["bank"].settled == 2 and results[2]["bank"].created == 0,
        "ctx.data writable": (data / "plugins" / "receipts" / "step3").exists(),
        "ctx.resolve closed the question": bool(q and q["answered"]),
    }
    for name, passed in checks.items():
        print("PASS" if passed else "FAIL", name)
        ok &= passed
finally:
    ff._call("DELETE", f"/v1/accounts/{acc}")
    print("test account deleted")
sys.exit(0 if ok else 1)
