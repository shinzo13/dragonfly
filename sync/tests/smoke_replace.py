"""replace_provisional against dev Firefly: create, reprice, a final of the same amount does not settle it, delete. Throwaway account."""

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
    "name": f"ffsync smoke replace {date.today()}", "type": "asset", "account_role": "defaultAsset",
    "currency_code": "PLN", "opening_balance": "100", "opening_balance_date": (date.today() - timedelta(days=20)).isoformat(),
})["data"]["id"]

tmp = Path(tempfile.mkdtemp())
plugins, data = tmp / "plugins", tmp / "data"
os.environ["SMOKE_STEP_FILE"] = str(tmp / "step")
(plugins / "erste").mkdir(parents=True)
(plugins / "erste" / "manifest.toml").write_text(textwrap.dedent(f"""
    id = "erste"
    name = "erste"
    kind = "source"
    [match]
    replace_provisional = true
    [accounts]
    main = {{ firefly_id = "{acc}", currency = "PLN" }}
"""))
(plugins / "erste" / "plugin.py").write_text(textwrap.dedent("""
    import os
    from datetime import date, timedelta
    from decimal import Decimal
    from ffsync.api import Batch, Tx

    def tx(eid, amount, payee):
        return Tx(external_id=eid, account="main", side="debit", amount=Decimal(amount), currency="PLN",
                  booked=date.today(), payee=payee, description=payee)

    class Erste:
        def fetch(self, ctx):
            s = int(open(os.environ["SMOKE_STEP_FILE"]).read())
            holds = {1: "76.40", 2: "50", 3: "50", 4: None, 5: "12"}[s]
            final = [tx("bank:1", "50", "LIDL")] if s == 3 else []
            return Batch(final=final, provisional=[tx("holds", holds, "Erste holds")] if holds else [])

    plugin = Erste()
"""))

core = Core(plugins, data, ff)
assert not core.errors, core.errors


def groups():
    out = []
    for g in ff.all(f"/v1/accounts/{acc}/transactions"):
        parts = g["attributes"]["transactions"]
        if parts[0]["type"] != "opening balance":
            out.append((parts[0]["external_id"], parts[0]["amount"][:5]))
    return sorted(out)


ok = True
try:
    seen = []
    for s in range(1, 6):
        (tmp / "step").write_text(str(s))
        report = core.run()
        seen.append(groups())
        print("run", s, [vars(r) for r in report.sources], seen[-1])
    checks = {
        "created": seen[0] == [("holds", "76.40")],
        "repriced in place": seen[1] == [("holds", "50.00")],
        "final of the same amount stays separate": seen[2] == [("bank:1", "50.00"), ("holds", "50.00")],
        "gone when the batch has none": seen[3] == [("bank:1", "50.00")],
        "the same id comes back": seen[4] == [("bank:1", "50.00"), ("holds", "12.00")],
    }
    for name, passed in checks.items():
        print("PASS" if passed else "FAIL", name)
        ok &= passed
finally:
    ff._call("DELETE", f"/v1/accounts/{acc}")
    print("test account deleted")
sys.exit(0 if ok else 1)
