# A bank's 429 ends the source's run without retries; the scheduler waits, the button does not. No Firefly needed: uv run --with pytest pytest tests/test_rejected.py

import textwrap
from datetime import UTC, datetime, timedelta
from email.utils import format_datetime

import pytest
from starlette.testclient import TestClient

from ffsync.engine import Core, retry_until
from ffsync.server import build, due_sources

PLUGIN = textwrap.dedent("""
    import httpx
    from ffsync.api import Batch

    class Bank:
        response = (200, {})
        calls = 0

        def fetch(self, ctx):
            self.calls += 1
            status, headers = self.response
            transport = httpx.MockTransport(lambda request: httpx.Response(status, headers=headers))
            httpx.Client(transport=transport).get("https://bank.test/tx").raise_for_status()
            return Batch(cursor="moved")

    plugin = Bank()
""")


class NoFirefly:
    def all(self, *args, **kwargs):
        return []


@pytest.fixture
def core(tmp_path):
    bank = tmp_path / "plugins" / "bank"
    bank.mkdir(parents=True)
    (bank / "manifest.toml").write_text(textwrap.dedent("""
        id = "bank"
        name = "Bank"
        kind = "source"
        [schedule]
        cron = "0 5 * * *"
        [accounts]
        main = { firefly_id = "1", currency = "PLN" }
    """))
    (bank / "plugin.py").write_text(PLUGIN)
    made = Core(tmp_path / "plugins", tmp_path / "data", NoFirefly())
    assert not made.errors, made.errors
    return made


def tomorrow_five():
    now = datetime.now(UTC)
    return (now + timedelta(days=1)).replace(hour=5, minute=0, second=0, microsecond=0)


def run(core, status=200, headers=None):
    core.modules["bank"].response = (status, headers or {})
    return core.run(["bank"]).sources[0]


def test_429_ends_the_run_without_retries_and_keeps_the_cursor(core):
    assert run(core).ok
    before = core.store.cursor("bank")
    core.store.run("update cursors set cursor = 'kept' where source = 'bank'")
    calls = core.modules["bank"].calls

    result = run(core, 429)

    assert core.modules["bank"].calls == calls + 1
    assert not result.ok and result.rejected
    after = core.store.cursor("bank")
    assert after["cursor"] == "kept"
    assert after["last_ok"] == before["last_ok"]
    assert "Traceback" not in result.error and "HTTPStatusError" not in result.error


def test_without_retry_after_the_next_scheduled_run_tries(core):
    result = run(core, 429)
    now = datetime.now(UTC)
    next_five = now.replace(hour=5, minute=0, second=0, microsecond=0)
    if next_five <= now:
        next_five += timedelta(days=1)
    assert result.retry_at == next_five.isoformat()
    assert due_sources(core, next_five) == ["bank"]


def test_retry_after_keeps_the_scheduler_away_until_it_passes(core):
    seconds = 2 * 24 * 3600
    result = run(core, 429, {"Retry-After": str(seconds)})
    until = datetime.now(UTC) + timedelta(seconds=seconds)
    assert result.rejected
    assert due_sources(core, tomorrow_five()) == []
    first = datetime.fromisoformat(result.retry_at)
    assert first >= until - timedelta(seconds=5)
    assert (first.hour, first.minute) == (5, 0)
    assert due_sources(core, first) == ["bank"]


def test_retry_after_as_a_date_and_garbage():
    at = datetime(2026, 11, 1, 5, 0, tzinfo=UTC)
    later = at + timedelta(hours=3)
    assert retry_until(format_datetime(later, usegmt=True), at) == later
    assert retry_until("120", at) == at + timedelta(seconds=120)
    assert retry_until("soon", at) is None
    assert retry_until(None, at) is None
    assert retry_until(format_datetime(at - timedelta(hours=1), usegmt=True), at) is None


def test_other_errors_are_failures_not_rejections(core):
    result = run(core, 500)
    assert not result.ok and not result.rejected and "HTTPStatusError" in result.error


def test_the_button_tries_once_during_the_wait_and_success_ends_it(core):
    run(core, 429, {"Retry-After": str(2 * 24 * 3600)})
    assert core.waiting("bank", datetime.now(UTC))
    calls = core.modules["bank"].calls
    core.modules["bank"].response = (200, {})
    client = TestClient(build(core))

    assert client.get("/sync/plugins").json()["plugins"][0]["blocked"] is None
    answer = client.post("/sync/plugins/bank/run")

    assert answer.status_code == 200
    assert answer.json()["sources"][0]["ok"]
    assert core.modules["bank"].calls == calls + 1
    assert not core.waiting("bank", datetime.now(UTC))
    assert due_sources(core, tomorrow_five()) == ["bank"]


def test_the_button_rejected_again_tries_once_and_reports_it(core):
    run(core, 429, {"Retry-After": "3600"})
    calls = core.modules["bank"].calls
    answer = TestClient(build(core)).post("/sync/plugins/bank/run")
    source = answer.json()["sources"][0]
    assert answer.status_code == 200
    assert source["rejected"] and source["retry_at"]
    assert core.modules["bank"].calls == calls + 1
    described = TestClient(build(core)).get("/sync/plugins").json()["plugins"][0]
    assert described["last_result"]["rejected"]
