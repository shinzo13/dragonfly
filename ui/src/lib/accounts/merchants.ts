import type { Account, Item } from "#lib/api/types.js";
import type { Range } from "#lib/dates.js";
import type { Flow } from "#lib/reports/flows.js";
import { typical, typicalToDay, versus } from "#lib/reports/typical.js";
import type { Targets } from "#lib/transactions/mass.js";

export type Kind = "expense" | "revenue";
export type SortKey = "month" | "year" | "visits" | "last" | "name";

export const SORT_KEYS: SortKey[] = ["month", "year", "visits", "last", "name"];
export const SPARK_MONTHS = 12;
const TOP = 5;

export interface Line {
  amount: number;
  approx: boolean;
  base: number;
  code: string;
  months: number[];
  ratio: number | null;
  seen: number;
  typical: number;
  visits: number;
}

export interface Merchant {
  category: string | null;
  fresh: boolean;
  id: string;
  last: string;
  lines: Line[];
  name: string;
  others: number;
  quiet: boolean;
  share: number;
  targets: Targets;
  value: number;
  visits: number;
  year: number;
}

export interface Total {
  amount: number;
  approx: boolean;
  base: number;
  code: string;
  ratio: number | null;
}

export interface Section {
  key: string;
  label: string;
  merchants: Merchant[];
  share: number;
  sums: Total[];
  visits: number;
}

export interface Board {
  fresh: number;
  merchants: Merchant[];
  past: number;
  top: number;
  totals: Total[];
}

export interface Context {
  day: number | null;
  kind: Kind;
  merge: string | null;
  months: string[];
  past: string[];
  range: Range;
  rate: (code: string) => number;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const foreign = (flows: Flow[], code: string) =>
  flows.some((flow) => flow.currency !== code);

function monthly(flows: Flow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const flow of flows) {
    const month = flow.date.slice(0, 7);
    map.set(month, (map.get(month) ?? 0) + flow.amount);
  }
  return map;
}

function lineOf(code: string, year: Flow[], now: Flow[], ctx: Context): Line {
  const byMonth = monthly(year);
  const amount = sum(now.map((flow) => flow.amount));
  const base = ctx.day === null ? 0 : typicalToDay(year, ctx.past, ctx.day);
  return {
    amount,
    approx: foreign(year, code) || foreign(now, code),
    base,
    code,
    months: ctx.months.slice(-SPARK_MONTHS).map((m) => byMonth.get(m) ?? 0),
    ratio: ctx.day === null ? null : versus(amount, base),
    seen: ctx.past.filter((m) => byMonth.has(m)).length,
    typical: typical(byMonth, ctx.past),
    visits: now.length,
  };
}

function dominant(flows: Flow[]): [string | null, number] {
  const counts = new Map<string, number>();
  for (const flow of flows) {
    const name = flow.category?.name ?? "";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const [top] = [...counts].sort((a, b) => b[1] - a[1]);
  return [top?.[0] || null, Math.max(0, counts.size - 1)];
}

function targetsOf(flows: Flow[]): Targets {
  const targets: Targets = new Map();
  for (const flow of flows) {
    const set = targets.get(flow.group) ?? new Set<string>();
    set.add(flow.journal);
    targets.set(flow.group, set);
  }
  return targets;
}

function bucket<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(key(item));
    if (list) {
      list.push(item);
    } else {
      map.set(key(item), [item]);
    }
  }
  return map;
}

const codeOf = (ctx: Context) => (flow: Flow) => ctx.merge ?? flow.currency;

const latest = (flows: Flow[]) =>
  flows.reduce((last, flow) => (flow.date > last ? flow.date : last), "");

function merchantOf(
  id: string,
  name: string,
  seen: string,
  year: Flow[],
  now: Flow[],
  ctx: Context
): Omit<Merchant, "share"> {
  const yearBy = bucket(year, codeOf(ctx));
  const nowBy = bucket(now, codeOf(ctx));
  const codes = new Set([...yearBy.keys(), ...nowBy.keys()]);
  const quiet = now.length === 0;
  const lines = [...codes]
    .map((code) =>
      lineOf(code, yearBy.get(code) ?? [], nowBy.get(code) ?? [], ctx)
    )
    .filter((line) => (quiet ? sum(line.months) > 0 : line.amount > 0))
    .sort(
      (a, b) =>
        b.amount * ctx.rate(b.code) - a.amount * ctx.rate(a.code) ||
        sum(b.months) * ctx.rate(b.code) - sum(a.months) * ctx.rate(a.code)
    );
  const [category, others] = dominant(quiet ? year : now);
  const before = year.filter((flow) => flow.date < ctx.range.start);
  return {
    category,
    fresh: !quiet && before.length === 0,
    id,
    last: latest(now) || seen || latest(year),
    lines,
    name,
    others,
    quiet,
    targets: targetsOf(now),
    value: sum(lines.map((line) => line.amount * ctx.rate(line.code))),
    visits: now.length,
    year: sum(lines.map((line) => sum(line.months) * ctx.rate(line.code))),
  };
}

export function board(
  accounts: Item<Account>[],
  flows: Flow[],
  periodFlows: Flow[],
  ctx: Context
): Board {
  const dir = ctx.kind === "expense" ? -1 : 1;
  const inRange = (flow: Flow) =>
    flow.date >= ctx.range.start && flow.date <= ctx.range.end;
  const mine = flows.filter((flow) => flow.dir === dir);
  const now = periodFlows.filter((flow) => flow.dir === dir && inRange(flow));
  const yearBy = bucket(mine, (flow) => flow.other.id);
  const nowBy = bucket(now, (flow) => flow.other.id);
  const names = new Map(
    [...mine, ...now].map((flow) => [flow.other.id, flow.other.name])
  );
  const seen = new Map<string, string>();
  for (const { id, attributes: a } of accounts) {
    if (a.type === ctx.kind && (a.active !== false || names.has(id))) {
      names.set(id, a.name);
      seen.set(id, a.last_activity?.slice(0, 10) ?? "");
    }
  }
  const drafts = [...names].map(([id, name]) =>
    merchantOf(
      id,
      name,
      seen.get(id) ?? "",
      yearBy.get(id) ?? [],
      nowBy.get(id) ?? [],
      ctx
    )
  );
  const total = sum(drafts.map((m) => m.value)) || 1;
  const merchants = drafts
    .map((m) => ({ ...m, share: m.value / total }))
    .sort(sortBy("month"));
  return {
    fresh: merchants.filter((m) => m.fresh).length,
    merchants,
    past: ctx.past.length,
    top: sum(merchants.slice(0, TOP).map((m) => m.share)),
    totals: totalsOf(mine, now, ctx),
  };
}

function totalsOf(year: Flow[], now: Flow[], ctx: Context): Total[] {
  const nowBy = bucket(now, codeOf(ctx));
  const yearBy = bucket(year, codeOf(ctx));
  return [...nowBy]
    .map(([code, list]) => {
      const amount = sum(list.map((flow) => flow.amount));
      const base =
        ctx.day === null
          ? 0
          : typicalToDay(yearBy.get(code) ?? [], ctx.past, ctx.day);
      return {
        amount,
        approx: foreign(list, code),
        base,
        code,
        ratio: ctx.day === null ? null : versus(amount, base),
      };
    })
    .sort((a, b) => b.amount * ctx.rate(b.code) - a.amount * ctx.rate(a.code));
}

const ORDER: Record<SortKey, (a: Merchant, b: Merchant) => number> = {
  last: (a, b) => b.last.localeCompare(a.last),
  month: (a, b) => b.value - a.value,
  name: (a, b) => a.name.localeCompare(b.name),
  visits: (a, b) => b.visits - a.visits,
  year: (a, b) => b.year - a.year,
};

export const sortBy =
  (key: SortKey) =>
  (a: Merchant, b: Merchant): number =>
    ORDER[key](a, b) || ORDER.last(a, b) || ORDER.name(a, b);

export function sumLines(merchants: Merchant[]): Total[] {
  const map = new Map<string, Total>();
  for (const line of merchants.flatMap((m) => m.lines)) {
    const total = map.get(line.code) ?? {
      amount: 0,
      approx: false,
      base: 0,
      code: line.code,
      ratio: null,
    };
    total.amount += line.amount;
    total.approx ||= line.approx;
    map.set(line.code, total);
  }
  return [...map.values()].filter((total) => total.amount > 0);
}

export function byCategory(merchants: Merchant[], none: string): Section[] {
  return [...bucket(merchants, (m) => m.category ?? "")]
    .map(([key, list]) => ({
      key: key || "none",
      label: key || none,
      merchants: list,
      share: sum(list.map((m) => m.share)),
      sums: sumLines(list),
      visits: sum(list.map((m) => m.visits)),
    }))
    .sort((a, b) => b.share - a.share || a.label.localeCompare(b.label));
}

const WHOLE_MONTH = 31;

export function monthDay(range: Range, now: string): number | null {
  const month = range.start.slice(0, 7);
  const last = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0
  ).getDate();
  const whole =
    range.start === `${month}-01` && range.end === `${month}-${last}`;
  if (!whole || month > now.slice(0, 7)) {
    return null;
  }
  return month === now.slice(0, 7) ? Number(now.slice(8, 10)) : WHOLE_MONTH;
}
