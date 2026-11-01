from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import uvicorn
from starlette.applications import Starlette
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from .cron import matches
from .engine import Core
from .firefly import Firefly
from .manifest import Manifest

log = logging.getLogger("ffsync")


def describe(core: Core, m: Manifest) -> dict[str, Any]:
    row = core.store.cursor(m.id)
    auth = core.store.one("select expires_at from auth where source = ?", m.id)
    last = core.store.one(
        "select report, finished from runs where report like ? order by id desc limit 1", f'%"source": "{m.id}"%'
    )
    result = None
    if last and last["report"]:
        result = next((s for s in json.loads(last["report"])["sources"] if s["source"] == m.id), None)
    return {
        "id": m.id,
        "name": m.name,
        "kind": m.kind,
        "icon": m.icon,
        "cron": m.cron,
        "min_interval": m.min_interval,
        "blocked": core.run_ready(m) if m.kind == "source" else None,
        "last_run": row["last_run"] if row else None,
        "last_ok": row["last_ok"] if row else None,
        "last_result": result,
        "auth": {"type": m.auth, "expires_at": auth["expires_at"] if auth else None},
        "settings": [
            {**asdict(s), "set": core.secret_path(m.id, s.key).exists()}
            if s.type == "secret"
            else {**asdict(s), "value": json.loads(core.store.setting(m.id, s.key) or "null")}
            for s in m.settings
        ],
    }


def build(core: Core) -> Starlette:
    async def plugins(_: Request) -> JSONResponse:
        return JSONResponse({"plugins": [describe(core, m) for m in core.manifests], "errors": core.errors})

    def report(r) -> dict[str, Any]:
        return {
            "sources": [asdict(s) for s in r.sources],
            "created": len(r.created),
            "questions": r.questions,
        }

    async def run_one(request: Request) -> JSONResponse:
        m = core.manifest(request.path_params["id"])
        if not m or m.kind != "source":
            return JSONResponse({"error": "no such source"}, 404)
        blocked = core.run_ready(m)
        if blocked:
            return JSONResponse({"error": blocked}, 429)
        try:
            return JSONResponse(report(await run_in_threadpool(core.run, [m.id])))
        except RuntimeError as error:
            return JSONResponse({"error": str(error)}, 409)

    async def run_all(_: Request) -> JSONResponse:
        try:
            return JSONResponse(report(await run_in_threadpool(core.run)))
        except RuntimeError as error:
            return JSONResponse({"error": str(error)}, 409)

    async def settings(request: Request) -> JSONResponse:
        m = core.manifest(request.path_params["id"])
        if not m:
            return JSONResponse({"error": "no such plugin"}, 404)
        if request.method == "PUT":
            body = await request.json()
            known = {s.key: s for s in m.settings}
            for key, value in body.items():
                if key not in known:
                    return JSONResponse({"error": f"unknown setting {key}"}, 400)
                if known[key].type == "secret":
                    core.write_secret(m.id, key, str(value))
                else:
                    core.store.set_setting(m.id, key, value)
        return JSONResponse(describe(core, m)["settings"])

    async def auth_start(request: Request) -> JSONResponse:
        m = core.manifest(request.path_params["id"])
        plugin = core.modules.get(m.id) if m else None
        if not m or m.auth == "none" or not hasattr(plugin, "start"):
            return JSONResponse({"error": "this plugin has no login"}, 404)
        body = await request.json()
        from .engine import Ctx

        return JSONResponse({"url": plugin.start(Ctx(core, m), body["return_url"])})

    async def auth_finish(request: Request) -> JSONResponse:
        m = core.manifest(request.path_params["id"])
        plugin = core.modules.get(m.id) if m else None
        if not m or not hasattr(plugin, "finish"):
            return JSONResponse({"error": "this plugin has no login"}, 404)
        from .engine import Ctx

        expires = plugin.finish(Ctx(core, m), await request.json())
        core.store.run("insert or replace into auth values (?, ?)", m.id, expires.isoformat())
        return JSONResponse({"expires_at": expires.isoformat()})

    async def runs(request: Request) -> JSONResponse:
        limit = int(request.query_params.get("limit", 20))
        rows = core.store.all("select * from runs order by id desc limit ?", limit)
        return JSONResponse(
            [{**dict(r), "report": json.loads(r["report"]) if r["report"] else None} for r in rows]
        )

    async def questions(_: Request) -> JSONResponse:
        rows = core.store.all("select * from questions where answered is null order by id")
        return JSONResponse([{**dict(r), "payload": json.loads(r["payload"])} for r in rows])

    async def answer(request: Request) -> JSONResponse:
        try:
            await run_in_threadpool(core.answer, int(request.path_params["id"]), await request.json())
        except KeyError as error:
            return JSONResponse({"error": str(error)}, 404)
        return JSONResponse({"ok": True})

    async def reload(_: Request) -> JSONResponse:
        core.reload()
        return JSONResponse({"plugins": len(core.manifests), "errors": core.errors})

    return Starlette(
        routes=[
            Route("/sync/plugins", plugins),
            Route("/sync/plugins/{id}/run", run_one, methods=["POST"]),
            Route("/sync/run", run_all, methods=["POST"]),
            Route("/sync/plugins/{id}/settings", settings, methods=["GET", "PUT"]),
            Route("/sync/plugins/{id}/auth/start", auth_start, methods=["POST"]),
            Route("/sync/plugins/{id}/auth/finish", auth_finish, methods=["POST"]),
            Route("/sync/runs", runs),
            Route("/sync/questions", questions),
            Route("/sync/questions/{id:int}", answer, methods=["POST"]),
            Route("/sync/reload", reload, methods=["POST"]),
        ]
    )


def due_sources(core: Core, at: datetime) -> list[str]:
    return [m.id for m in core.of_kind("source") if m.cron and matches(m.cron, at) and not core.waiting(m.id, at)]


def scheduler(core: Core) -> None:
    last = ""
    while True:
        at = datetime.now(UTC).replace(second=0, microsecond=0)
        stamp = at.isoformat()
        if stamp != last:
            last = stamp
            due = due_sources(core, at)
            if due:
                try:
                    core.run(due)
                except RuntimeError:
                    log.info("skipped scheduled run, another one is going")
                except Exception:
                    log.exception("scheduled run failed")
        time.sleep(20)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    firefly = Firefly(os.environ["FIREFLY_URL"], Path(os.environ["FIREFLY_TOKEN_FILE"]).read_text().strip())
    core = Core(Path(os.environ.get("FFSYNC_PLUGINS", "plugins")), Path(os.environ.get("FFSYNC_DATA", "data")), firefly)
    for error in core.errors:
        log.warning(error)
    if os.environ.get("FFSYNC_SCHEDULER", "1") == "1":
        threading.Thread(target=scheduler, args=(core,), daemon=True).start()
    uvicorn.run(build(core), host=os.environ.get("FFSYNC_HOST", "127.0.0.1"), port=int(os.environ.get("FFSYNC_PORT", "38091")))
