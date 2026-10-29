from __future__ import annotations

import importlib.util
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from types import ModuleType
from typing import Any

from .api import VERSION

KINDS = ("source", "matcher", "enricher", "hook")
PREFIX_RULES = ("first_word", "full", "none")


class ManifestError(Exception):
    pass


@dataclass
class Setting:
    key: str
    label: str
    type: str = "string"
    required: bool = False


@dataclass
class Manifest:
    id: str
    name: str
    kind: str
    path: Path
    icon: str = "plug"
    version: int = VERSION
    cron: str | None = None
    after: list[str] = field(default_factory=list)
    phase: str = "after"
    requests_per_day: int | None = None
    min_interval: int = 0
    settle_days: int = 3
    expire_days: int = 10
    payee_prefix: str = "first_word"
    lookback_days: int = 0
    gap_tolerance: str = "0.01"
    accounts: dict[str, dict[str, str]] = field(default_factory=dict)
    settings: list[Setting] = field(default_factory=list)
    auth: str = "none"
    provisional_prefix: str | None = None

    @property
    def secrets(self) -> list[str]:
        return [s.key for s in self.settings if s.type == "secret"]


def _seconds(text: str | int) -> int:
    if isinstance(text, int):
        return text
    units = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    return int(text[:-1]) * units[text[-1]] if text and text[-1] in units else int(text)


def load_manifest(folder: Path) -> Manifest:
    raw: dict[str, Any] = tomllib.loads((folder / "manifest.toml").read_text())
    try:
        kind = raw["kind"]
        manifest = Manifest(id=raw["id"], name=raw["name"], kind=kind, path=folder)
    except KeyError as missing:
        raise ManifestError(f"{folder.name}: manifest needs {missing}") from None
    if kind not in KINDS:
        raise ManifestError(f"{manifest.id}: kind must be one of {', '.join(KINDS)}")
    if raw.get("version", VERSION) > VERSION:
        raise ManifestError(f"{manifest.id}: needs interface v{raw['version']}, core speaks v{VERSION}")
    manifest.icon = raw.get("icon", manifest.icon)
    schedule = raw.get("schedule", {})
    manifest.cron = schedule.get("cron")
    manifest.after = list(schedule.get("after", []))
    manifest.phase = schedule.get("phase", "after")
    if manifest.phase not in ("before", "after"):
        raise ManifestError(f"{manifest.id}: phase must be before or after")
    budget = raw.get("budget", {})
    manifest.requests_per_day = budget.get("requests_per_day")
    manifest.min_interval = _seconds(budget.get("min_interval", 0))
    match = raw.get("match", {})
    manifest.settle_days = int(match.get("settle_days", 3))
    manifest.expire_days = int(match.get("expire_days", 10))
    manifest.payee_prefix = match.get("payee_prefix", "first_word")
    manifest.lookback_days = int(match.get("lookback_days", 0))
    manifest.gap_tolerance = str(match.get("gap_tolerance", "0.01"))
    if manifest.payee_prefix not in PREFIX_RULES:
        raise ManifestError(f"{manifest.id}: payee_prefix must be one of {', '.join(PREFIX_RULES)}")
    manifest.accounts = {key: {k: str(v) for k, v in value.items()} for key, value in raw.get("accounts", {}).items()}
    manifest.settings = [Setting(**s) for s in raw.get("settings", [])]
    manifest.auth = raw.get("auth", {}).get("type", "none")
    manifest.provisional_prefix = raw.get("migrate", {}).get("provisional_prefix")
    if kind == "source" and not manifest.accounts:
        raise ManifestError(f"{manifest.id}: a source needs [accounts]")
    return manifest


def load_module(manifest: Manifest) -> ModuleType:
    spec = importlib.util.spec_from_file_location(f"ffsync_plugin_{manifest.id.replace('-', '_')}", manifest.path / "plugin.py")
    if not spec or not spec.loader:
        raise ManifestError(f"{manifest.id}: no plugin.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, "plugin"):
        raise ManifestError(f"{manifest.id}: plugin.py must define `plugin`")
    return module


def discover(root: Path) -> tuple[list[Manifest], list[str]]:
    found: list[Manifest] = []
    errors: list[str] = []
    for folder in sorted(p for p in root.iterdir() if (p / "manifest.toml").exists()):
        try:
            found.append(load_manifest(folder))
        except (ManifestError, tomllib.TOMLDecodeError, TypeError) as error:
            errors.append(str(error))
    ids = [m.id for m in found]
    for dup in {i for i in ids if ids.count(i) > 1}:
        errors.append(f"two plugins share the id {dup}")
    return found, errors
