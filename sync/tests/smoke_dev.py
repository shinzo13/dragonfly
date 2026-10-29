"""End-to-end check against dev Firefly. Creates a throwaway account, deletes it at the end."""

import json
import sys
import tempfile
import textwrap
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from ffsync.engine import Core
from ffsync.firefly import Firefly

URL = "http://127.0.0.1:38090"
TOKEN = (Path(__file__).parent.parent / "data" / "firefly_token").read_text().strip()

ff = Firefly(URL, TOKEN)
acc = ff._call("POST", "/v1/accounts", json={
    "name": f"ffsync smoke {date.today()}", "type": "asset", "account_role": "defaultAsset",
    "currency_code": "PLN", "opening_balance": "100", "opening_balance_date": (date.today() - timedelta(days=10)).isoformat(),
})["data"]["id"]
print("test account", acc)
gram = ff._call("POST", "/v1/accounts", json={
    "name": f"ffsync smoke gram {date.today()}", "type": "asset", "account_role": "savingAsset", "currency_id": ff.currency_id("GRAM"),
})["data"]["id"]

tmp = Path(tempfile.mkdtemp())
plugins, data = tmp / "plugins", tmp / "data"
(plugins / "demo").mkdir(parents=True)
(plugins / "demo" / "manifest.toml").write_text(textwrap.dedent(f"""
    id = "demo"
    name = "Demo bank"
    kind = "source"
    [budget]
    requests_per_day = 5
    [match]
    settle_days = 3
    expire_days = 10
    [migrate]
    provisional_prefix = "pdng:"
    [accounts]
    main = {{ firefly_id = "{acc}", currency = "PLN" }}
    ton = {{ firefly_id = "{gram}", currency = "GRAM" }}
"""))
(plugins / "demo" / "plugin.py").write_text(textwrap.dedent("""
    import json, os
    from datetime import date, timedelta, datetime, UTC
    from decimal import Decimal
    from ffsync.api import Batch, Balance, Tx

    STEP = os.environ["SMOKE_STEP_FILE"]

    class Demo:
        def legacy_ids(self, tx):
            return [tx.external_id.removeprefix("demo:")]

        def fetch(self, ctx):
            ctx.spend()
            step = int(open(STEP).read())
            today = date.today()
            pending = Tx(external_id="demo:pending:1", account="main", side="debit", amount=Decimal("12.50"),
                         currency="PLN", booked=today - timedelta(days=2), payee="ZABKA Z4560 K.1", description="Zabka")
            legacy = [
                Tx(external_id="demo:legacy-1", account="main", side="debit", amount=Decimal("5"), currency="PLN",
                   booked=today - timedelta(days=5), payee="Old shop", description="old, already in Firefly"),
                Tx(external_id="demo:3", account="main", side="debit", amount=Decimal("7.5"), currency="PLN",
                   booked=today - timedelta(days=3), payee="LIDL 112", description="Lidl"),
            ]
            if step == 1:
                return Batch(final=legacy + [
                    Tx(external_id="demo:1", account="main", side="debit", amount=Decimal("30"), currency="PLN",
                       booked=today - timedelta(days=3), payee="Kaufland 2084", description="Kaufland"),
                Tx(external_id="demo:ton:1", account="ton", side="credit", amount=Decimal("1.5"), currency="GRAM",
                   booked=today - timedelta(days=3), payee="mrkt.ton", description="mrkt"),
                ], provisional=[pending])
            return Batch(final=[
                Tx(external_id="demo:2", account="main", side="debit", amount=Decimal("12.5"), currency="PLN",
                   booked=today - timedelta(days=1), payee="ZABKA Z0004", description="ZABKA settled"),
                Tx(external_id="demo:1", account="main", side="debit", amount=Decimal("30"), currency="PLN",
                   booked=today - timedelta(days=3), payee="Kaufland 2084", description="Kaufland"),
            ], balances=[Balance(account="main", amount=Decimal("50.00"), currency="PLN", at=datetime.now(UTC))])

    plugin = Demo()
"""))
step_file = tmp / "step"
import os
os.environ["SMOKE_STEP_FILE"] = str(step_file)

from ffsync.api import Tx as _Tx
old_1 = ff.create(_Tx(external_id="legacy-1", account="main", side="debit", amount=Decimal("5"), currency="PLN",
                      booked=date.today() - timedelta(days=5), payee="Old shop", description="old"), acc)
old_pending = ff.create(_Tx(external_id="pdng:9", account="main", side="debit", amount=Decimal("7.50"), currency="PLN",
                      booked=date.today() - timedelta(days=4), payee="LIDL 9", description="old pending"), acc)

core = Core(plugins, data, ff)
assert not core.errors, core.errors
ok = True
try:
    step_file.write_text("1")
    r1 = core.run()
    print("run 1", [vars(s) for s in r1.sources])
    step_file.write_text("2")
    r2 = core.run()
    print("run 2", [vars(s) for s in r2.sources])
    txs = ff.all(f"/v1/accounts/{acc}/transactions")
    flat = [(t["attributes"]["transactions"][0]["description"], t["attributes"]["transactions"][0]["amount"][:6],
             t["attributes"]["transactions"][0]["external_id"], t["attributes"]["transactions"][0]["date"][:10]) for t in txs]
    print("firefly", flat)
    print("balance", ff.account_balance(acc))
    print("questions", [dict(q) for q in core.store.all("select type, text from questions")])
    s1, s2 = r1.sources[0], r2.sources[0]
    checks = {
        "run1 created 3 (incl GRAM)": s1.created == 3,
        "legacy final skipped": s1.skipped == 1,
        "legacy pending settled by new final": s1.settled == 1,
        "GRAM balance": ff.account_balance(gram) == Decimal("1.5"),
        "run2 settled 1, skipped 1": s2.settled == 1 and s2.skipped == 1 and s2.created == 0,
        "5 transactions total incl opening": len(txs) == 5,
        "pending got the final id": any(f[2] == "demo:2" for f in flat),
        "balance gap asked": len(core.store.all("select 1 from questions where type='unexplained_gap'")) == 1,
        "budget counted": core.store.used_today("demo") == 2,
    }
    for name, passed in checks.items():
        print("PASS" if passed else "FAIL", name)
        ok &= passed
finally:
    for leftover in ff.all("/v1/accounts", type="asset"):
        if leftover["attributes"]["name"].startswith("ffsync smoke"):
            ff._call("DELETE", f"/v1/accounts/{leftover['id']}")
    print("test account deleted")
sys.exit(0 if ok else 1)
