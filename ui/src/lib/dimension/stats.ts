import type { BudgetLimit, Item } from "#lib/api/types.js";
import {
  type Lane,
  type StackKey,
  tones,
  wash,
} from "#lib/components/charts/chart.js";
import { contains, daysBetween, type Range } from "#lib/dates.js";
import { monthOf, shortMonth } from "#lib/reports/board.js";
import { inDisplay } from "#lib/reports/display.js";
import { type Flow, group, type Totals } from "#lib/reports/flows.js";
import type { Rate } from "#lib/reports/rates.js";
import { money } from "#lib/reports/report.svelte.js";
import { median, pace, series, typical, versus } from "#lib/reports/typical.js";
import { modeAxis } from "#lib/reports/view.js";
import type { Facet } from "./spec.js";

export type Dir = 1 | -1;

export interface Money {
  amount: number;
  code: string;
}

export interface Facts {
  count: number;
  first: string;
  last: string;
  median: Money | null;
  sums: Money[];
}

export interface Norm {
  code: string;
  projected: number | null;
  ratio: number | null;
  typical: number;
}

export interface FacetRow {
  href?: string;
  key: string;
  label: string;
  share: number;
  spark: number[];
  sums: Money[];
}

export interface LimitFact {
  amount: number;
  code: string;
  day: number | null;
  days: number;
  id: string;
  spent: number;
}

export interface StripCell {
  amount: number;
  id: string | null;
  month: string;
  spent: number;
}

const BRAND = "var(--ff-brand)";
const PLURAL = /s$/;
const LEFT_WASH = 28;

export const counted = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun.replace(PLURAL, "") : noun}`;

export const fmt = (code: string, amount: number, decimals?: number) =>
  money(code, amount, false, decimals);

export function dirOf(flows: Flow[]): Dir {
  const out = flows.filter((flow) => flow.dir === -1).length;
  return out * 2 >= flows.length ? -1 : 1;
}

function tally(flows: Flow[]) {
  const by = new Map<string, { count: number; sum: number }>();
  for (const flow of flows) {
    const t = by.get(flow.currency) ?? { count: 0, sum: 0 };
    t.count += 1;
    t.sum += flow.amount;
    by.set(flow.currency, t);
  }
  return by;
}

export function codesOf(flows: Flow[]): string[] {
  const by = tally(flows);
  return [...by.keys()].sort(
    (a, b) => (by.get(b)?.count ?? 0) - (by.get(a)?.count ?? 0)
  );
}

export function sumsOf(flows: Flow[], codes: string[]): Money[] {
  const by = tally(flows);
  return codes
    .filter((code) => by.has(code))
    .map((code) => ({ amount: by.get(code)?.sum ?? 0, code }));
}

export function factsOf(flows: Flow[], codes: string[]): Facts {
  const main = codes.find((code) => flows.some((f) => f.currency === code));
  let first = "";
  let last = "";
  for (const flow of flows) {
    first = !first || flow.date < first ? flow.date : first;
    last = flow.date > last ? flow.date : last;
  }
  const amounts = flows.filter((f) => f.currency === main).map((f) => f.amount);
  return {
    count: new Set(flows.map((flow) => flow.group)).size,
    first,
    last,
    median: main ? { amount: median(amounts), code: main } : null,
    sums: sumsOf(flows, codes),
  };
}

export function normsOf(
  flows: Flow[],
  codes: string[],
  months: string[],
  focus: string | null,
  now: string
): Norm[] {
  const by = series(flows, (flow) => flow.currency);
  return codes.map((code) => {
    const typ = typical(by.get(code), months);
    if (focus === monthOf(now)) {
      const p = pace(
        flows.filter((flow) => flow.currency === code),
        months,
        now
      );
      const projected = p.sofar + typ - p.typical;
      return { code, projected, ratio: versus(projected, typ), typical: typ };
    }
    const value = focus ? (by.get(code)?.get(focus) ?? 0) : 0;
    return {
      code,
      projected: null,
      ratio: focus ? versus(value, typ) : null,
      typical: typ,
    };
  });
}

export function lanesOf(
  flows: Flow[],
  months: string[],
  codes: string[],
  dir: Dir,
  norms: Norm[],
  height: number
): Lane[] {
  const key: StackKey = {
    color: BRAND,
    key: "value",
    label: dir === -1 ? "Spent" : "Earned",
  };
  const main = series(
    flows.filter((flow) => flow.dir === dir),
    (flow) => flow.currency
  );
  const back = series(
    flows.filter((flow) => flow.dir !== dir),
    (flow) => flow.currency
  );
  return codes.map((code) => ({
    axisFormat: modeAxis(code),
    dots: back.has(code)
      ? Object.fromEntries(
          months.map((month) => [month, back.get(code)?.get(month) ?? 0])
        )
      : undefined,
    format: (value: number) => fmt(code, value, 0),
    height,
    key: code,
    keys: [key],
    label: code,
    rows: months.map((month) => ({
      key: month,
      label: shortMonth(month),
      values: { value: main.get(code)?.get(month) ?? 0 },
    })),
    typical: norms.find((n) => n.code === code)?.typical || null,
  }));
}

const LIMIT_KEYS: StackKey[] = [
  { color: BRAND, key: "spent", label: "Spent" },
  { color: wash(BRAND, LEFT_WASH), key: "left", label: "Left" },
  { color: tones.expense, key: "over", label: "Overspent" },
];

const limitKey = (code: string, month: string) => `${code} ${month}`;

function limitsByMonth(limits: Item<BudgetLimit>[]) {
  const by = new Map<string, number>();
  for (const limit of limits) {
    const k = limitKey(
      limit.attributes.currency_code ?? "",
      monthOf(limit.attributes.start ?? "")
    );
    by.set(k, (by.get(k) ?? 0) + Number(limit.attributes.amount));
  }
  return by;
}

export function withLimits(lanes: Lane[], limits: Item<BudgetLimit>[]): Lane[] {
  const by = limitsByMonth(limits);
  return lanes.map((lane) => ({
    ...lane,
    keys: LIMIT_KEYS,
    rows: lane.rows.map((row) => {
      const spent = row.values.value ?? 0;
      const limit = by.get(limitKey(lane.key, row.key));
      const values: Record<string, number> = limit
        ? {
            left: Math.max(0, limit - spent),
            over: Math.max(0, spent - limit),
            spent: Math.min(spent, limit),
          }
        : { spent };
      return { ...row, values };
    }),
  }));
}

export function limitsIn(
  limits: Item<BudgetLimit>[],
  into: string | null
): Item<BudgetLimit>[] {
  if (!into) {
    return limits;
  }
  const merged = new Map<string, Item<BudgetLimit>>();
  for (const limit of limits) {
    const a = limit.attributes;
    const shown = inDisplay(Number(a.amount), a.currency_code ?? "", into);
    const key = [shown.code, a.start, a.end].join("|");
    const found = merged.get(key);
    const amount = shown.amount + Number(found?.attributes.amount ?? 0);
    const base = found ?? limit;
    merged.set(key, {
      ...base,
      attributes: {
        ...base.attributes,
        amount: String(amount),
        currency_code: shown.code,
      },
    });
  }
  return [...merged.values()];
}

const limitRangeOf = (limit: Item<BudgetLimit>): Range => ({
  end: (limit.attributes.end ?? "").slice(0, 10),
  start: (limit.attributes.start ?? "").slice(0, 10),
});

const spentIn = (flows: Flow[], code: string, range: Range) =>
  flows
    .filter((flow) => flow.currency === code && contains(range, flow.date))
    .reduce((sum, flow) => sum + flow.amount, 0);

export function limitFacts(
  limits: Item<BudgetLimit>[],
  flows: Flow[],
  range: Range,
  now: string
): LimitFact[] {
  return limits
    .filter((limit) => {
      const r = limitRangeOf(limit);
      return r.start <= range.end && r.end >= range.start;
    })
    .map((limit) => {
      const r = limitRangeOf(limit);
      const code = limit.attributes.currency_code ?? "";
      return {
        amount: Number(limit.attributes.amount),
        code,
        day: contains(r, now) ? daysBetween(r.start, now) + 1 : null,
        days: daysBetween(r.start, r.end) + 1,
        id: limit.id,
        spent: spentIn(flows, code, r),
      };
    });
}

export function stripsOf(
  limits: Item<BudgetLimit>[],
  flows: Flow[],
  months: string[]
): Map<string, StripCell[]> {
  const spent = series(flows, (flow) => flow.currency);
  const strips = new Map<string, StripCell[]>();
  const codes = new Set(limits.map((l) => l.attributes.currency_code ?? ""));
  for (const code of codes) {
    const own = limits.filter((l) => l.attributes.currency_code === code);
    const cells = months.map((month) => {
      const limit = own.find(
        (l) => monthOf(l.attributes.start ?? "") === month
      );
      return {
        amount: limit ? Number(limit.attributes.amount) : 0,
        id: limit?.id ?? null,
        month,
        spent: spent.get(code)?.get(month) ?? 0,
      };
    });
    if (cells.some((cell) => cell.id)) {
      strips.set(code, cells);
    }
  }
  return strips;
}

export function weigh(
  flows: Flow[],
  primary: string,
  rate: Rate
): (code: string) => number {
  const codes = [...new Set(flows.map((flow) => flow.currency))];
  const rates = new Map(
    codes.map((code) => [code, code === primary ? 1 : rate(code, primary)])
  );
  if ([...rates.values()].every((r) => r !== null)) {
    return (code) => rates.get(code) ?? 0;
  }
  const by = tally(flows);
  return (code) => {
    const t = by.get(code);
    return t && t.sum > 0 ? t.count / t.sum : 0;
  };
}

export function facetRows(
  facet: Facet,
  period: Flow[],
  window: Flow[],
  months: string[],
  codes: string[],
  weight: (code: string) => number
): FacetRow[] {
  const worth = (totals: Totals | undefined) => {
    let sum = 0;
    for (const [code, m] of totals?.cur ?? []) {
      sum += (m.in + m.out) * weight(code);
    }
    return sum;
  };
  const sparks = new Map(
    group(window, facet.of, (flow) => monthOf(flow.date)).map((row) => [
      row.key,
      months.map((month) => worth(row.cells.get(month))),
    ])
  );
  const total =
    period.reduce(
      (sum, flow) => sum + flow.amount * weight(flow.currency),
      0
    ) || 1;
  return group(period, facet.of)
    .map((row) => ({
      href: row.href,
      key: row.key,
      label: row.label,
      share: worth(row.totals) / total,
      spark: sparks.get(row.key) ?? [],
      sums: codes
        .filter((code) => row.totals.cur.has(code))
        .map((code) => {
          const m = row.totals.cur.get(code);
          return { amount: (m?.in ?? 0) + (m?.out ?? 0), code };
        }),
    }))
    .sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));
}
