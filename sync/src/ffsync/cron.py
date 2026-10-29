from __future__ import annotations

from datetime import datetime

RANGES = ((0, 59), (0, 23), (1, 31), (1, 12), (0, 6))


def _field(text: str, low: int, high: int) -> set[int]:
    out: set[int] = set()
    for part in text.split(","):
        step = 1
        if "/" in part:
            part, raw = part.split("/")
            step = int(raw)
        if part == "*":
            start, stop = low, high
        elif "-" in part:
            a, b = part.split("-")
            start, stop = int(a), int(b)
        else:
            start = stop = int(part)
        out.update(range(start, stop + 1, step))
    return out


def matches(expr: str, at: datetime) -> bool:
    parts = expr.split()
    if len(parts) != 5:
        raise ValueError(f"cron needs 5 fields: {expr!r}")
    minute, hour, day, month, weekday = (_field(p, *r) for p, r in zip(parts, RANGES))
    return (
        at.minute in minute
        and at.hour in hour
        and at.day in day
        and at.month in month
        and (at.isoweekday() % 7) in weekday
    )
