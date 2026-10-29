import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type { Account, BasicSummaryEntry } from "#lib/api/types.js";
import { addDays, today } from "#lib/dates.js";
import {
  compactMoney,
  formatMoney,
  type Money,
  toNumber,
} from "#lib/format.js";
import { display } from "#lib/money/display.svelte.js";
import { period } from "#lib/period.svelte.js";
import { session } from "#lib/session.svelte.js";

export interface Cur {
  code: string;
  decimals: number;
  symbol: string;
}

export interface SummaryEntry extends Cur {
  amount: number;
  noBudgets: boolean;
  sub: string;
  title: string;
}

export interface ChartSet {
  currency_code: string;
  currency_decimal_places: number;
  currency_symbol?: string;
  entries: Record<string, string | number>;
  label: string;
  pc_entries?: Record<string, string | number> | unknown[];
  primary_currency_code?: string;
  primary_currency_decimal_places?: number;
  primary_currency_symbol?: string;
}

export interface InsightEntry {
  currency_code: string;
  difference: string;
  difference_float?: number;
  id?: string;
  name?: string;
}

const SUMMARY_KEY = /^(.+)-in-([A-Z0-9]+)$/;

export function currency(code: string): Cur {
  const found = session.currencies.find((c) => c.attributes.code === code);
  return {
    code,
    decimals: found?.attributes.decimal_places ?? 2,
    symbol: found?.attributes.symbol ?? code,
  };
}

export const setCurrency = (set: ChartSet): Cur => ({
  ...currency(set.currency_code),
  ...(set.currency_symbol ? { symbol: set.currency_symbol } : {}),
});

export const money = (cur: Cur) => (value: number) =>
  formatMoney({
    amount: value,
    code: cur.code,
    decimals: cur.decimals,
    symbol: cur.symbol,
  });

export const axis = (cur: Cur) => (value: number) =>
  compactMoney(value, cur.symbol);

export const primaryCode = () => session.primary?.code ?? "";

export function byCurrency<T>(
  items: T[],
  code: (item: T) => string
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = code(item);
    const list = groups.get(key);
    if (list) {
      list.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  const primary = primaryCode();
  return [...groups.entries()].sort(
    ([a, la], [b, lb]) =>
      Number(b === primary) - Number(a === primary) || lb.length - la.length
  );
}

export function mergeable(codes: string[]): boolean {
  return (
    display.active &&
    codes.some((code) => code !== display.code) &&
    codes.every((code) => display.rate(code) !== null)
  );
}

export function rough(parts: Money[], approx = true): string {
  const text = display.text(parts);
  return approx && !text.startsWith("≈") ? `~${text}` : text;
}

export function parseSummary(
  raw: Record<string, BasicSummaryEntry> | undefined
): Record<string, SummaryEntry[]> {
  const result: Record<string, SummaryEntry[]> = {};
  for (const [key, entry] of Object.entries(raw ?? {})) {
    const match = key.match(SUMMARY_KEY);
    if (!match) {
      continue;
    }
    const extra = entry as BasicSummaryEntry & {
      no_available_budgets?: boolean;
    };
    const list = result[match[1]] ?? [];
    list.push({
      amount: toNumber(entry.monetary_value),
      code: entry.currency_code ?? match[2],
      decimals: entry.currency_decimal_places ?? 2,
      noBudgets: extra.no_available_budgets === true,
      sub: entry.sub_title ?? "",
      symbol: entry.currency_symbol ?? match[2],
      title: entry.title ?? "",
    });
    result[match[1]] = list;
  }
  const primary = primaryCode();
  for (const list of Object.values(result)) {
    list.sort(
      (a, b) =>
        Number(b.code === primary) - Number(a.code === primary) ||
        Math.abs(b.amount) - Math.abs(a.amount)
    );
  }
  return result;
}

export function hasPrimary(sets: ChartSet[]): boolean {
  return (
    session.prefs.convert_to_primary === true &&
    sets.length > 0 &&
    sets.every((s) => s.pc_entries && !Array.isArray(s.pc_entries))
  );
}

export function upTo(end: string): string {
  const now = today();
  return end < now ? end : now;
}

export function periodQuery(extra: Record<string, unknown> = {}) {
  return { end: period.end, start: period.start, ...extra };
}

export function hrefWith(
  url: { href: string },
  changes: Record<string, string | null>
): string {
  const next = new URL(url.href);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) {
      next.searchParams.delete(name);
    } else {
      next.searchParams.set(name, value);
    }
  }
  next.searchParams.set("start", period.start);
  next.searchParams.set("end", period.end);
  return next.pathname + next.search;
}

export const summaryQuery = (start: string, end: string) => ({
  queryFn: () =>
    api<Record<string, BasicSummaryEntry>>("/v1/summary/basic", {
      query: { end, start },
    }),
  queryKey: ["summary", start, end],
});

export const accountsChartQuery = (
  start: string,
  end: string,
  everything = false
) => ({
  queryFn: () =>
    api<ChartSet[]>("/v1/chart/account/overview", {
      query: {
        ...span(start, end),
        period: "1D",
        preselected: everything ? "all" : undefined,
      },
    }),
  queryKey: ["chart-accounts", start, end, everything],
});

export function seriesPoints(set: ChartSet, converted: boolean) {
  const entries = (converted ? set.pc_entries : set.entries) as
    | Record<string, string | number>
    | undefined;
  return Object.entries(entries ?? {}).map(([date, value]) => ({
    x: date.slice(0, 10),
    y: toNumber(value),
  }));
}

export function setPrimary(set: ChartSet): Cur {
  return currency(set.primary_currency_code ?? set.currency_code);
}

export function balanceDate(start: string, end: string): string {
  const until = upTo(end);
  return until < start ? end : until;
}

export function balanceRange(start: string, end: string) {
  const until = balanceDate(start, end);
  return until > start ? { date: until, end: until, start } : { date: until };
}

export function span(start: string, end: string) {
  return { end: end > start ? end : addDays(start, 1), start };
}

export const accountsQuery = (type: string, start: string, end: string) => ({
  queryFn: () =>
    all<Account>("/v1/accounts", { ...balanceRange(start, end), type }),
  queryKey: ["accounts", type, start, end],
});

export function proportional(counts: number[]): string {
  return counts.map((n) => `minmax(8rem, ${Math.max(2, n)}fr)`).join(" ");
}
