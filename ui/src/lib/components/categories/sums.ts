import type { Item, Split, TransactionGroup } from "#lib/api/types.js";
import {
  daysBetween,
  isDynamic,
  periodOf,
  type Range,
  shiftPeriod,
  type ViewRange,
} from "#lib/dates.js";
import { currentLocale, formatDate, toNumber } from "#lib/format.js";

export interface Cur {
  code: string;
  decimals: number;
  symbol: string;
}

export interface Sum extends Cur {
  amount: number;
}

export type Sums = Record<string, Sum>;

export interface Entry {
  currency_code?: string;
  currency_decimal_places?: number;
  currency_symbol?: string;
  sum?: string;
}

export interface Row {
  group: Item<TransactionGroup>;
  split: Split;
}

export interface Totals {
  count: number;
  earned: Sums;
  spent: Sums;
  transferred: Sums;
}

export interface PeriodTotals {
  range: Range;
  totals: Totals;
}

export interface Bar {
  amount: number;
  href?: string;
  label: string;
}

export interface Breakdown {
  bars: Bar[];
  cur: Cur;
  total: number;
}

export const curOfSplit = (split: Split): Cur => ({
  code: split.currency_code ?? "",
  decimals: split.currency_decimal_places ?? 2,
  symbol: split.currency_symbol ?? "",
});

export const curOfEntry = (entry: Entry): Cur => ({
  code: entry.currency_code ?? "",
  decimals: entry.currency_decimal_places ?? 2,
  symbol: entry.currency_symbol ?? "",
});

export function add(sums: Sums, cur: Cur, value: number) {
  const current = sums[cur.code] ?? { ...cur, amount: 0 };
  current.amount += value;
  sums[cur.code] = current;
}

export const list = (sums: Sums): Sum[] =>
  Object.values(sums)
    .filter((sum) => Math.abs(sum.amount) > 1e-9)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

export function fromEntries(entries: Entry[] | null | undefined): Sum[] {
  const sums: Sums = {};
  for (const entry of entries ?? []) {
    add(sums, curOfEntry(entry), toNumber(entry.sum));
  }
  return list(sums);
}

export const amountIn = (sums: Sum[], code: string) =>
  sums.find((sum) => sum.code === code)?.amount ?? 0;

export function rows(
  groups: Item<TransactionGroup>[],
  keep: (split: Split) => boolean = () => true
): Row[] {
  return groups.flatMap((group) =>
    group.attributes.transactions
      .filter(keep)
      .map((split) => ({ group, split }))
  );
}

export const dayOf = (row: Row) => row.split.date.slice(0, 10);

export function totals(items: Row[]): Totals {
  const result: Totals = { count: 0, earned: {}, spent: {}, transferred: {} };
  const groups = new Set<string>();
  for (const { group, split } of items) {
    groups.add(group.id);
    const amount = toNumber(split.amount);
    const cur = curOfSplit(split);
    if (split.type === "withdrawal") {
      add(result.spent, cur, -amount);
    } else if (split.type === "deposit") {
      add(result.earned, cur, amount);
    } else if (split.type === "transfer") {
      add(result.transferred, cur, amount);
    }
  }
  result.count = groups.size;
  return result;
}

export function inRange(items: Row[], range: Range): Row[] {
  return items.filter((row) => {
    const day = dayOf(row);
    return day >= range.start && day <= range.end;
  });
}

export function periodRanges(
  end: string,
  view: ViewRange,
  count: number
): Range[] {
  const fixed = isDynamic(view) ? "1M" : view;
  let range = periodOf(end, fixed);
  const out = [range];
  for (let i = 1; i < count; i += 1) {
    range = shiftPeriod(range, fixed, -1);
    out.push(range);
  }
  return out;
}

export function byPeriod(items: Row[], ranges: Range[]): PeriodTotals[] {
  return ranges.map((range) => ({
    range,
    totals: totals(inRange(items, range)),
  }));
}

const DAILY_MAX = 31;
const WEEKLY_MAX = 120;
const MONTHLY_MAX = 1100;

export function stepRanges(range: Range): Range[] {
  const days = daysBetween(range.start, range.end) + 1;
  let view: ViewRange = "1Y";
  if (days <= DAILY_MAX) {
    view = "1D";
  } else if (days <= WEEKLY_MAX) {
    view = "1W";
  } else if (days <= MONTHLY_MAX) {
    view = "1M";
  }
  const out: Range[] = [];
  let step = periodOf(range.start, view);
  while (step.start <= range.end) {
    out.push(step);
    step = shiftPeriod(step, view, 1);
  }
  return out;
}

export function firstDay(items: Row[]): string | null {
  let first: string | null = null;
  for (const row of items) {
    const day = dayOf(row);
    if (!first || day < first) {
      first = day;
    }
  }
  return first;
}

export function breakdown(
  items: Row[],
  pick: (split: Split) => { href?: string; label: string }
): Breakdown[] {
  const byCur = new Map<
    string,
    { cur: Cur; bars: Map<string, Bar>; total: number }
  >();
  for (const { split } of items) {
    const cur = curOfSplit(split);
    const amount = toNumber(split.amount);
    const entry = byCur.get(cur.code) ?? { bars: new Map(), cur, total: 0 };
    const { href, label } = pick(split);
    const bar = entry.bars.get(label) ?? { amount: 0, href, label };
    bar.amount += amount;
    entry.bars.set(label, bar);
    entry.total += amount;
    byCur.set(cur.code, entry);
  }
  return [...byCur.values()]
    .map(({ cur, bars, total }) => ({
      bars: [...bars.values()].sort((a, b) => b.amount - a.amount),
      cur,
      total,
    }))
    .sort((a, b) => b.bars.length - a.bars.length);
}

export function stepLabel(range: Range, view: ViewRange): string {
  const fixed = isDynamic(view) ? "1M" : view;
  const month = Number(range.start.slice(5, 7));
  const year = range.start.slice(0, 4);
  switch (fixed) {
    case "1M":
      return new Intl.DateTimeFormat(currentLocale(), {
        month: "short",
        year: "2-digit",
      }).format(new Date(Number(year), month - 1, 1));
    case "3M":
      return `Q${Math.ceil(month / 3)} ${year}`;
    case "6M":
      return `H${month <= 6 ? 1 : 2} ${year}`;
    case "1Y":
      return year;
    default:
      return formatDate(range.start, "short");
  }
}

export const SIDEBAR_PERIODS = 12;

export function windowOf(end: string, view: ViewRange): Range {
  const ranges = periodRanges(end, view, SIDEBAR_PERIODS);
  return { end, start: ranges.at(-1)?.start ?? end };
}
