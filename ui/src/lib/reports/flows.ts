import type { Item, Split, TransactionGroup } from "#lib/api/types.js";
import type { Grain } from "./params.js";

export interface Ref {
  id: string;
  name: string;
}

export interface Party extends Ref {
  type: string;
}

export interface Flow {
  amount: number;
  asset: Party;
  bill: Ref | null;
  budget: Ref | null;
  category: Ref | null;
  currency: string;
  date: string;
  description: string;
  dir: 1 | -1;
  group: string;
  journal: string;
  other: Party;
  pc: number | null;
  tags: string[];
  type: string;
}

export interface Measure {
  in: number;
  n: number;
  out: number;
}

export interface Totals {
  cur: Map<string, Measure>;
  n: number;
  pc: Measure;
  pcOk: boolean;
}

export interface Key {
  href?: string;
  key: string;
  label: string;
}

export interface Row extends Key {
  cells: Map<string, Totals>;
  totals: Totals;
}

export type Side = "in" | "out" | "net";

const NUMERIC = (value: string | null | undefined) =>
  value === null || value === undefined || value === "" ? null : Number(value);

const ref = (id: string | null | undefined, name: string | null | undefined) =>
  id ? { id: String(id), name: name ?? "" } : null;

function party(split: Split, side: "source" | "destination"): Party {
  return {
    id: String(split[`${side}_id`] ?? ""),
    name: split[`${side}_name`] ?? "",
    type: split[`${side}_type`] ?? "",
  };
}

function inbound(
  split: Split,
  currencyOf: (id: string) => string | undefined
): { amount: number; currency: string } {
  const foreign = NUMERIC(split.foreign_amount);
  const code = split.foreign_currency_code;
  if (
    foreign !== null &&
    code &&
    currencyOf(String(split.destination_id)) === code
  ) {
    return { amount: foreign, currency: code };
  }
  return { amount: Number(split.amount), currency: split.currency_code ?? "" };
}

function toFlow(
  split: Split,
  groupId: string,
  outgoing: boolean,
  currencyOf: (id: string) => string | undefined
): Flow {
  const value = outgoing
    ? { amount: Number(split.amount), currency: split.currency_code ?? "" }
    : inbound(split, currencyOf);
  return {
    ...value,
    asset: party(split, outgoing ? "source" : "destination"),
    bill: ref(split.bill_id, split.bill_name),
    budget: ref(split.budget_id, split.budget_name),
    category: ref(split.category_id, split.category_name),
    date: split.date.slice(0, 10),
    description: split.description,
    dir: outgoing ? -1 : 1,
    group: groupId,
    journal: String(split.transaction_journal_id ?? ""),
    other: party(split, outgoing ? "destination" : "source"),
    pc: NUMERIC(split.pc_amount),
    tags: split.tags ?? [],
    type: split.type,
  };
}

export function toFlows(
  groups: Item<TransactionGroup>[],
  selected: ReadonlySet<string>,
  currencyOf: (id: string) => string | undefined = () => undefined
): Flow[] {
  const flows: Flow[] = [];
  for (const item of groups) {
    for (const split of item.attributes.transactions) {
      const outgoing = selected.has(String(split.source_id));
      if (outgoing !== selected.has(String(split.destination_id))) {
        flows.push(toFlow(split, item.id, outgoing, currencyOf));
      }
    }
  }
  return flows;
}

export function flowValue(flow: Flow, mode: string): number | null {
  if (mode === "pc") {
    return flow.pc;
  }
  return flow.currency === mode ? flow.amount : null;
}

export const emptyTotals = (): Totals => ({
  cur: new Map(),
  n: 0,
  pc: { in: 0, n: 0, out: 0 },
  pcOk: true,
});

export function add(totals: Totals, flow: Flow) {
  let measure = totals.cur.get(flow.currency);
  if (!measure) {
    measure = { in: 0, n: 0, out: 0 };
    totals.cur.set(flow.currency, measure);
  }
  const side = flow.dir === 1 ? "in" : "out";
  measure[side] += flow.amount;
  measure.n += 1;
  totals.n += 1;
  if (flow.pc === null) {
    totals.pcOk = false;
  } else {
    totals.pc[side] += flow.pc;
    totals.pc.n += 1;
  }
}

export function total(flows: Iterable<Flow>): Totals {
  const totals = emptyTotals();
  for (const flow of flows) {
    add(totals, flow);
  }
  return totals;
}

export function measureOf(totals: Totals, mode: string): Measure | undefined {
  return mode === "pc" ? totals.pc : totals.cur.get(mode);
}

export function amountOf(
  totals: Totals | undefined,
  mode: string,
  side: Side
): number {
  const measure = totals ? measureOf(totals, mode) : undefined;
  if (!measure) {
    return 0;
  }
  if (side === "net") {
    return measure.in - measure.out;
  }
  return measure[side];
}

export type KeyFn = (flow: Flow) => Key | Key[] | null;
export type ColFn = (flow: Flow) => string | null;

export function group(flows: Iterable<Flow>, keyOf: KeyFn, colOf?: ColFn) {
  const rows = new Map<string, Row>();
  for (const flow of flows) {
    const found = keyOf(flow);
    if (!found) {
      continue;
    }
    const col = colOf?.(flow) ?? null;
    for (const key of Array.isArray(found) ? found : [found]) {
      let row = rows.get(key.key);
      if (!row) {
        row = { ...key, cells: new Map(), totals: emptyTotals() };
        rows.set(key.key, row);
      }
      add(row.totals, flow);
      if (col !== null) {
        let cell = row.cells.get(col);
        if (!cell) {
          cell = emptyTotals();
          row.cells.set(col, cell);
        }
        add(cell, flow);
      }
    }
  }
  return [...rows.values()];
}

export function rank<T extends { label: string; totals: Totals }>(
  rows: T[],
  mode: string,
  side: Side
): T[] {
  const score = (row: T) => Math.abs(amountOf(row.totals, mode, side));
  return [...rows].sort(
    (a, b) => score(b) - score(a) || a.label.localeCompare(b.label)
  );
}

export function currencies(totals: Totals, codes?: string[]): string[] {
  const present = [...totals.cur.keys()];
  if (!codes) {
    return present.sort();
  }
  return [
    ...codes.filter((code) => totals.cur.has(code)),
    ...present.filter((code) => !codes.includes(code)).sort(),
  ];
}

export const NONE = "0";

export const keys = {
  asset: (flow: Flow): Key => ({
    href: `/accounts/show/${flow.asset.id}`,
    key: flow.asset.id,
    label: flow.asset.name,
  }),
  bill: (flow: Flow): Key =>
    flow.bill
      ? {
          href: `/subscriptions/show/${flow.bill.id}`,
          key: flow.bill.id,
          label: flow.bill.name,
        }
      : { key: NONE, label: "(no subscription)" },
  budget: (flow: Flow): Key | null => {
    if (flow.dir === 1 || flow.type !== "withdrawal") {
      return null;
    }
    return flow.budget
      ? {
          href: `/budgets/show/${flow.budget.id}`,
          key: flow.budget.id,
          label: flow.budget.name,
        }
      : { key: NONE, label: "(no budget)" };
  },
  category: (flow: Flow): Key =>
    flow.category
      ? {
          href: `/categories/show/${flow.category.id}`,
          key: flow.category.id,
          label: flow.category.name,
        }
      : { key: NONE, label: "(no category)" },
  name: (flow: Flow): Key => ({
    key: flow.other.name.toLowerCase(),
    label: flow.other.name,
  }),
  other: (flow: Flow): Key => ({
    href: `/accounts/show/${flow.other.id}`,
    key: flow.other.id,
    label: flow.other.name,
  }),
  tag: (flow: Flow): Key[] =>
    flow.tags.length > 0
      ? flow.tags.map((tag) => ({
          href: `/tags/show/${encodeURIComponent(tag)}`,
          key: tag,
          label: tag,
        }))
      : [{ key: NONE, label: "(no tags)" }],
};

export type Dimension = keyof typeof keys;

export function matches(flow: Flow, dim: Dimension, key: string): boolean {
  const found = keys[dim](flow);
  if (!found) {
    return false;
  }
  return Array.isArray(found)
    ? found.some((item) => item.key === key)
    : found.key === key;
}

export function bucketOf(date: string, grain: Grain): string {
  if (grain === "year") {
    return date.slice(0, 4);
  }
  return grain === "month" ? date.slice(0, 7) : date.slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function buckets(start: string, end: string, grain: Grain): string[] {
  const list: string[] = [];
  if (grain === "year") {
    for (
      let y = Number(start.slice(0, 4));
      y <= Number(end.slice(0, 4));
      y += 1
    ) {
      list.push(String(y));
    }
    return list;
  }
  if (grain === "month") {
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    const last = end.slice(0, 7);
    while (`${y}-${pad(m)}` <= last) {
      list.push(`${y}-${pad(m)}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return list;
  }
  const d = new Date(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10))
  );
  for (;;) {
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (key > end) {
      return list;
    }
    list.push(key);
    d.setDate(d.getDate() + 1);
  }
}

export function bucketRange(
  key: string,
  grain: Grain,
  clip?: { start: string; end: string }
): { start: string; end: string } {
  let range: { start: string; end: string };
  if (grain === "year") {
    range = { end: `${key}-12-31`, start: `${key}-01-01` };
  } else if (grain === "month") {
    const [y, m] = key.split("-").map(Number);
    range = {
      end: `${key}-${pad(new Date(y, m, 0).getDate())}`,
      start: `${key}-01`,
    };
  } else {
    range = { end: key, start: key };
  }
  if (!clip) {
    return range;
  }
  return {
    end: range.end > clip.end ? clip.end : range.end,
    start: range.start < clip.start ? clip.start : range.start,
  };
}

export function topFlows(
  flows: Iterable<Flow>,
  mode: string,
  dir: 1 | -1,
  limit: number
): Flow[] {
  const list: Flow[] = [];
  for (const flow of flows) {
    if (flow.dir !== dir) {
      continue;
    }
    if (mode === "pc" ? flow.pc !== null : flow.currency === mode) {
      list.push(flow);
    }
  }
  const amount = (flow: Flow) => (mode === "pc" ? (flow.pc ?? 0) : flow.amount);
  return list.sort((a, b) => amount(b) - amount(a)).slice(0, limit);
}

export function modes(totals: Totals, codes: string[]): string[] {
  const list = currencies(totals, codes);
  return totals.pcOk && list.length > 1 ? ["pc", ...list] : list;
}

export function daily(flows: Iterable<Flow>, mode: string, dir: 1 | -1) {
  const days = new Map<string, { value: number; n: number }>();
  for (const flow of flows) {
    if (flow.dir !== dir) {
      continue;
    }
    const value = flowValue(flow, mode);
    if (value === null) {
      continue;
    }
    const day = days.get(flow.date) ?? { n: 0, value: 0 };
    day.value += value;
    day.n += 1;
    days.set(flow.date, day);
  }
  return days;
}

export function merge(list: (Totals | undefined)[]): Totals {
  const result = emptyTotals();
  for (const totals of list) {
    if (!totals) {
      continue;
    }
    for (const [code, m] of totals.cur) {
      const target = result.cur.get(code) ?? { in: 0, n: 0, out: 0 };
      target.in += m.in;
      target.out += m.out;
      target.n += m.n;
      result.cur.set(code, target);
    }
    result.n += totals.n;
    result.pc.in += totals.pc.in;
    result.pc.out += totals.pc.out;
    result.pc.n += totals.pc.n;
    result.pcOk &&= totals.pcOk;
  }
  return result;
}

export interface Exchange {
  date: string;
  from: string;
  fromAmount: number;
  to: string;
  toAmount: number;
}

export function exchanges(
  groups: Item<TransactionGroup>[],
  selected: ReadonlySet<string>,
  currencyOf: (id: string) => string | undefined
): Exchange[] {
  const list: Exchange[] = [];
  for (const item of groups) {
    for (const split of item.attributes.transactions) {
      const source = String(split.source_id);
      const destination = String(split.destination_id);
      if (!(selected.has(source) && selected.has(destination))) {
        continue;
      }
      const from = split.currency_code ?? currencyOf(source) ?? "";
      const to = split.foreign_currency_code ?? currencyOf(destination) ?? from;
      const foreign = NUMERIC(split.foreign_amount);
      if (from !== to && foreign !== null) {
        list.push({
          date: split.date.slice(0, 10),
          from,
          fromAmount: Number(split.amount),
          to,
          toAmount: foreign,
        });
      }
    }
  }
  return list;
}
