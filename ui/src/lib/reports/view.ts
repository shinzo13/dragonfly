import type { StackKey, StackRow } from "#lib/components/charts/chart.js";
import { tones } from "#lib/components/charts/chart.js";
import { compactMoney, formatDate } from "#lib/format.js";
import { session } from "#lib/session.svelte.js";
import { bucketOf, type Flow, flowValue } from "./flows.js";
import type { Grain } from "./params.js";
import { currencyMeta, money } from "./report.svelte.js";

export function bucketLabel(key: string, grain: Grain, short = false): string {
  if (grain === "year") {
    return key;
  }
  if (grain === "month") {
    const date = `${key}-01`;
    return short
      ? new Intl.DateTimeFormat(session.locale, {
          month: "short",
          year: "2-digit",
        }).format(
          new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)
        )
      : formatDate(date, "month");
  }
  return short ? formatDate(key, "short") : formatDate(key, "day");
}

export const FLOW_KEYS: StackKey[] = [
  { color: tones.income, key: "in", label: "Earned" },
  { color: tones.expense, key: "out", label: "Spent" },
];

export function bucketRows(
  flows: Iterable<Flow>,
  keys: string[],
  grain: Grain,
  mode: string
): StackRow[] {
  const sums = new Map(keys.map((key) => [key, { in: 0, out: 0 }]));
  for (const flow of flows) {
    const value = flowValue(flow, mode);
    const bucket = sums.get(bucketOf(flow.date, grain));
    if (value === null || !bucket) {
      continue;
    }
    bucket[flow.dir === 1 ? "in" : "out"] += value;
  }
  return keys.map((key) => {
    const sum = sums.get(key) ?? { in: 0, out: 0 };
    return {
      key,
      label: bucketLabel(key, grain, true),
      values: { in: sum.in, out: -sum.out },
    };
  });
}

export function modeFormat(mode: string) {
  return (value: number) => money(mode, value);
}

export function modeAxis(mode: string) {
  const symbol =
    mode === "pc" ? (session.primary?.symbol ?? "") : currencyMeta(mode).symbol;
  return (value: number) => compactMoney(value, symbol);
}

export function upright(rows: StackRow[]): StackRow[] {
  if (rows.some((row) => (row.values.in ?? 0) !== 0)) {
    return rows;
  }
  return rows.map((row) => ({
    ...row,
    values: { out: Math.abs(row.values.out ?? 0) },
  }));
}
