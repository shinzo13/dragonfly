import type { Item } from "#lib/api/types.js";
import { toNumber } from "#lib/format.js";
import { today } from "#lib/dates.js";
import type { AccountX, ChartSet } from "./data.js";
import { view } from "./money.svelte.js";
import type { Row } from "./tx.js";

export function seriesOf(sets: ChartSet[] | undefined, start: string, end: string) {
  const sums = new Map<string, number>();
  const last = end < today() ? end : today();
  for (const set of sets ?? []) {
    const entries = (set.pc_entries && !Array.isArray(set.pc_entries) ? set.pc_entries : set.entries) ?? {};
    const primary = set.pc_entries && !Array.isArray(set.pc_entries);
    for (const [stamp, raw] of Object.entries(entries)) {
      const date = stamp.slice(0, 10);
      if (date < start || date > last) {
        continue;
      }
      const value = primary ? view.fromPrimary(raw) : (view.conv(raw, set.currency_code) ?? 0);
      sums.set(date, (sums.get(date) ?? 0) + value);
    }
  }
  return [...sums.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export function balanceOf(a: AccountX): number {
  return view.conv(a.current_balance, a.currency_code) ?? view.fromPrimary(a.pc_current_balance);
}

export function worth(accounts: Item<AccountX>[] | undefined): number {
  return (accounts ?? [])
    .filter((a) => a.attributes.active && a.attributes.include_net_worth !== false)
    .reduce((s, a) => s + balanceOf(a.attributes), 0);
}

export function rowValue(row: Row): number {
  return Math.abs(view.conv(row.amount, row.code) ?? view.fromPrimary(row.pc));
}

export interface Slice {
  id: string | null;
  name: string;
  value: number;
  count: number;
}

export function spendByCategory(rows: Row[]): Slice[] {
  const map = new Map<string, Slice>();
  for (const row of rows) {
    if (row.kind !== "out") {
      continue;
    }
    for (const split of row.splits) {
      const id = split.category_id ?? null;
      const key = id ?? "none";
      const value = Math.abs(view.conv(split.amount, split.currency_code) ?? view.fromPrimary(split.pc_amount));
      const slice = map.get(key) ?? { count: 0, id, name: split.category_name ?? "No category", value: 0 };
      slice.value += value;
      slice.count += 1;
      map.set(key, slice);
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export function totals(rows: Row[]) {
  let spent = 0;
  let earned = 0;
  for (const row of rows) {
    if (row.kind === "out") {
      spent += rowValue(row);
    } else if (row.kind === "in") {
      earned += rowValue(row);
    }
  }
  return { earned, spent };
}

export const n = toNumber;

export function deltas(sets: ChartSet[] | undefined, start: string, end: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const set of sets ?? []) {
    const series = seriesOf([set], start, end);
    if (series.length > 1) {
      out.set(set.label, series[series.length - 1].value - series[0].value);
    }
  }
  return out;
}
