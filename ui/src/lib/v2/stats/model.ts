import type { Split } from "#lib/api/types.js";
import { addDays, addMonths, today } from "#lib/dates.js";
import { view } from "../money.svelte.js";
import { prettify, type Row } from "../tx.js";

export interface Month {
  key: string;
  start: string;
  end: string;
  label: string;
}

const SHORT = new Intl.DateTimeFormat("en-GB", { month: "short" });

export function monthsUpTo(end: string, count: number): Month[] {
  const last = `${end.slice(0, 7)}-01`;
  const out: Month[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = addMonths(last, -i);
    const stop = addDays(addMonths(start, 1), -1);
    out.push({ end: stop, key: start.slice(0, 7), label: SHORT.format(new Date(`${start}T00:00`)), start });
  }
  return out;
}

export const splitValue = (s: Split) => Math.abs(view.conv(s.amount, s.currency_code) ?? view.fromPrimary(s.pc_amount));

export function flow(rows: Row[], months: Month[]) {
  const map = new Map(months.map((m) => [m.key, { earned: 0, month: m, spent: 0 }]));
  for (const row of rows) {
    const slot = map.get(row.date.slice(0, 7));
    if (!slot || row.kind === "move") {
      continue;
    }
    const value = row.splits.reduce((s, x) => s + splitValue(x), 0);
    if (row.kind === "out") {
      slot.spent += value;
    } else {
      slot.earned += value;
    }
  }
  return [...map.values()];
}

export interface CatSlice {
  id: string | null;
  name: string;
  value: number;
}

export function categoriesByMonth(rows: Row[], months: Month[], top = 6) {
  const totals = new Map<string, CatSlice>();
  const cells = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (row.kind !== "out") {
      continue;
    }
    const month = row.date.slice(0, 7);
    for (const s of row.splits) {
      const key = s.category_id ?? "none";
      const value = splitValue(s);
      const total = totals.get(key) ?? { id: s.category_id ?? null, name: s.category_name ?? "No category", value: 0 };
      total.value += value;
      totals.set(key, total);
      const cell = cells.get(month) ?? new Map<string, number>();
      cell.set(key, (cell.get(key) ?? 0) + value);
      cells.set(month, cell);
    }
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1].value - a[1].value);
  const keep = ranked.slice(0, top).map(([key]) => key);
  const series = ranked.slice(0, top).map(([key, slice]) => ({ key, ...slice }));
  const hasOther = ranked.length > top;
  const columns = months.map((m) => {
    const cell = cells.get(m.key) ?? new Map<string, number>();
    const parts = keep.map((key) => ({ key, value: cell.get(key) ?? 0 }));
    const other = [...cell.entries()].filter(([key]) => !keep.includes(key)).reduce((s, [, v]) => s + v, 0);
    if (hasOther) {
      parts.push({ key: "other", value: other });
    }
    return { month: m, parts, total: parts.reduce((s, p) => s + p.value, 0) };
  });
  return { columns, hasOther, series };
}

export function byTag(rows: Row[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.kind !== "out") {
      continue;
    }
    for (const s of row.splits) {
      for (const tag of (s.tags ?? []).slice(0, 1)) {
        map.set(tag, (map.get(tag) ?? 0) + splitValue(s));
      }
    }
  }
  return [...map.entries()].map(([tag, value]) => ({ tag, value })).sort((a, b) => b.value - a.value);
}

export function places(rows: Row[]) {
  const map = new Map<string, { id: string; name: string; count: number; value: number }>();
  for (const row of rows) {
    if (row.kind !== "out" || !row.otherId) {
      continue;
    }
    const name = prettify(row.other);
    const key = name.toLowerCase();
    const slot = map.get(key) ?? { count: 0, id: row.otherId, name, value: 0 };
    slot.count += 1;
    slot.value += row.splits.reduce((s, x) => s + splitValue(x), 0);
    map.set(key, slot);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export function days(rows: Row[]) {
  const map = new Map<string, { count: number; value: number }>();
  for (const row of rows) {
    if (row.kind !== "out") {
      continue;
    }
    const slot = map.get(row.date) ?? { count: 0, value: 0 };
    slot.count += 1;
    slot.value += row.splits.reduce((s, x) => s + splitValue(x), 0);
    map.set(row.date, slot);
  }
  return map;
}

export const lastDay = (end: string) => (end < today() ? end : today());

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function squarify<T extends { value: number }>(items: T[], box: Box): (T & Box)[] {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total <= 0 || items.length === 0) {
    return [];
  }
  const scale = (box.w * box.h) / total;
  const out: (T & Box)[] = [];
  let rest = items.map((i) => ({ area: i.value * scale, item: i }));
  let { x, y, w, h } = box;
  const worst = (row: { area: number }[], side: number) => {
    const sum = row.reduce((s, r) => s + r.area, 0);
    const max = Math.max(...row.map((r) => r.area));
    const min = Math.min(...row.map((r) => r.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };
  while (rest.length) {
    const side = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) {
      row.push(rest[i]);
      i += 1;
    }
    rest = rest.slice(i);
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (w >= h) {
      const rw = sum / h;
      let cy = y;
      for (const r of row) {
        const rh = r.area / rw;
        out.push({ ...r.item, h: rh, w: rw, x, y: cy });
        cy += rh;
      }
      x += rw;
      w -= rw;
    } else {
      const rh = sum / w;
      let cx = x;
      for (const r of row) {
        const rw = r.area / rh;
        out.push({ ...r.item, h: rh, w: rw, x: cx, y });
        cx += rw;
      }
      y += rh;
      h -= rh;
    }
  }
  return out;
}

export function niceTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo) / count || 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) {
    out.push(Math.round(v * 100) / 100);
  }
  if (out[out.length - 1] < hi) {
    out.push(out[out.length - 1] + step);
  }
  return out;
}
