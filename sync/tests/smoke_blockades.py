# blockades against dev Firefly: created with the tag, repriced in place, deleted when gone, untouched by a final of the same amount. Throwaway account.

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
    "name": f"ffsync smoke blockades {date.today()}", "type": "asset", "account_role": "defaultAsset",
    "currency_code": "PLN", "opening_balance": "100", "opening_balance_date": (date.today() - timedelta(days=20)).isoformat(),
})["data"]["id"]

tmp = Path(tempfile.mkdtemp())
plugins, data = tmp / "plugins", tmp / "data"
os.environ["SMOKE_STEP_FILE"] = str(tmp / "step")
(plugins / "bank").mkdir(parents=True)
(plugins / "bank" / "manifest.toml").write_text(textwrap.dedent(f"""
    id = "bank"
    name = "bank"
    kind = "source"
    [accounts]
    main = {{ firefly_id = "{acc}", currency = "PLN" }}
"""))
(plugins / "bank" / "plugin.py").write_text(textwrap.dedent("""
    import os
    from datetime import date
    from decimal import Decimal
    from ffsync.api import Batch, Blockade, Tx

    class Bank:
        def fetch(self, ctx):
            s = int(open(os.environ["SMOKE_STEP_FILE"]).read())
            amount = {1: "76.40", 2: "50", 3: "50", 4: None, 5: "12"}[s]
            final = [Tx(external_id="bank:1", account="main", side="debit", amount=Decimal("50"), currency="PLN",
                        booked=date.today(), payee="LIDL", description="LIDL")] if s == 3 else []
            return Batch(final=final, blockades=[Blockade("main", Decimal(amount), "PLN")] if amount else [])

    plugin = Bank()
"""))

core = Core(plugins, data, ff)
assert not core.errors, core.errors


def groups():
    out = []
    for g in ff.all(f"/v1/accounts/{acc}/transactions"):
        part = g["attributes"]["transactions"][0]
        if part["type"] != "opening balance":
            out.append((part["external_id"], part["amount"][:5], part["tags"]))
    return sorted(out)


BLOCKADE = "bank:blockade:main"
ok = True
try:
    seen = []
    for s in range(1, 6):
        (tmp / "step").write_text(str(s))
        report = core.run()
        assert all(r.ok for r in report.sources), report.sources
        seen.append(groups())
        print("run", s, seen[-1])
    balance_with = ff.account_balance(acc)
    checks = {
        "created with the tag": seen[0] == [(BLOCKADE, "76.40", ["blockade"])],
        "repriced in place": seen[1] == [(BLOCKADE, "50.00", ["blockade"])],
        "final of the same amount stays separate": seen[2] == [("bank:1", "50.00", []), (BLOCKADE, "50.00", ["blockade"])],
        "gone when the batch has none": seen[3] == [("bank:1", "50.00", [])],
        "comes back": seen[4] == [("bank:1", "50.00", []), (BLOCKADE, "12.00", ["blockade"])],
        "lowers the balance": balance_with == 38,
    }
    (tmp / "step").write_text("5")
    gone = next(g for g in ff.all(f"/v1/accounts/{acc}/transactions") if g["attributes"]["transactions"][0]["external_id"] == BLOCKADE)
    ff.delete(gone["id"])
    (tmp / "step").write_text("2")
    core.run()
    checks["recreated after a manual delete"] = (BLOCKADE, "50.00", ["blockade"]) in groups()
    for name, passed in checks.items():
        print("PASS" if passed else "FAIL", name)
        ok &= passed
finally:
    ff._call("DELETE", f"/v1/accounts/{acc}")
    print("test account deleted")
sys.exit(0 if ok else 1)
