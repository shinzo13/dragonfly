import type { Account, Item, TransactionGroup } from "#lib/api/types.js";
import {
  addDays,
  addMonths,
  contains,
  eachDay,
  type Range,
} from "#lib/dates.js";
import {
  compactMoney,
  formatMoney,
  type Money,
  toNumber,
} from "#lib/format.js";
import { display } from "#lib/money/display.svelte.js";

export type Flow =
  | "income"
  | "movedIn"
  | "spent"
  | "movedOut"
  | "opening"
  | "adjusted";
export type Side = "asset" | "credit" | "debit";
export type Tone = "income" | "expense" | "transfer" | "neutral";

export interface Move {
  amount: number;
  date: string;
  flow: Flow;
  reconciled: boolean;
}

export interface Anchor {
  balance: number;
  date: string;
}

export interface Term {
  flow: Flow;
  label: string;
  tone: Tone;
  up: boolean;
  value: number;
}

type Part = Omit<Term, "up">;

export type Sums = Record<Flow, number>;

export const MONTHS = 13;
export const FOUR: Flow[] = ["income", "movedIn", "spent", "movedOut"];
const FLOWS: Flow[] = [...FOUR, "opening", "adjusted"];
const REAL = new Set(["withdrawal", "deposit"]);
const OPENING = new Set(["opening balance", "liability credit"]);
const CENT = 0.005;
const PRECISION = 1e6;

const clean = (value: number) => Math.round(value * PRECISION) / PRECISION;

const WORDS: Record<Side, { into: string; out: string }> = {
  asset: { into: "Income", out: "Spent" },
  credit: { into: "Lent", out: "Got back" },
  debit: { into: "Paid back", out: "Borrowed" },
};

export const sideOf = (account: Account, liability: boolean): Side => {
  if (!liability) {
    return "asset";
  }
  return account.liability_direction === "debit" ? "debit" : "credit";
};

export const signOf = (side: Side) => (side === "debit" ? -1 : 1);

function flowOf(type: string, into: boolean): Flow {
  if (type === "transfer") {
    return into ? "movedIn" : "movedOut";
  }
  if (REAL.has(type)) {
    return into ? "income" : "spent";
  }
  return OPENING.has(type) ? "opening" : "adjusted";
}

export function moves(
  id: string,
  code: string | null | undefined,
  groups: Item<TransactionGroup>[]
): Move[] {
  const list: Move[] = [];
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      const into = split.destination_id === id;
      if (!(into || split.source_id === id)) {
        continue;
      }
      const foreign =
        split.currency_code !== code && split.foreign_currency_code === code;
      const amount = Math.abs(
        toNumber(foreign ? split.foreign_amount : split.amount)
      );
      list.push({
        amount: into ? amount : -amount,
        date: split.date.slice(0, 10),
        flow: flowOf(split.type, into),
        reconciled: Boolean(split.reconciled),
      });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function sums(list: Move[], range: Range) {
  const total = Object.fromEntries(FLOWS.map((f) => [f, 0])) as Sums;
  let rows = 0;
  for (const m of list) {
    if (contains(range, m.date)) {
      total[m.flow] += m.amount;
      rows += 1;
    }
  }
  for (const flow of FLOWS) {
    total[flow] = clean(total[flow]);
  }
  return { rows, total };
}

export function balanceAt(list: Move[], anchor: Anchor, day: string): number {
  let value = anchor.balance;
  for (const m of list) {
    if (m.date > anchor.date && m.date <= day) {
      value += m.amount;
    } else if (m.date <= anchor.date && m.date > day) {
      value -= m.amount;
    }
  }
  return clean(value);
}

export function daily(list: Move[], anchor: Anchor, range: Range) {
  const byDay = new Map<string, number>();
  for (const m of list) {
    byDay.set(m.date, (byDay.get(m.date) ?? 0) + m.amount);
  }
  let value = balanceAt(list, anchor, addDays(range.start, -1));
  return eachDay(range).map((day) => {
    value = clean(value + (byDay.get(day) ?? 0));
    return { x: day, y: value };
  });
}

export function monthsOf(range: Range, list: Move[]) {
  return Array.from({ length: MONTHS }, (_, i) => {
    const start = addMonths(range.start, i);
    return {
      month: start,
      total: sums(list, { end: addDays(addMonths(start, 1), -1), start }).total,
    };
  });
}

export function chartRange(period: Range, now: string): Range {
  const current = `${now.slice(0, 7)}-01`;
  const asked = `${period.end.slice(0, 7)}-01`;
  const recent = asked <= current && asked >= addMonths(current, 1 - MONTHS);
  const last = recent ? current : asked;
  return {
    end: addDays(addMonths(last, 1), -1),
    start: addMonths(last, 1 - MONTHS),
  };
}

export function terms(side: Side, total: Sums): Term[] {
  const s = signOf(side);
  const words = WORDS[side];
  const asset = side === "asset";
  const into: Part = {
    flow: "income",
    label: words.into,
    tone: asset ? "income" : "expense",
    value: s * total.income,
  };
  const movedIn: Part = {
    flow: "movedIn",
    label: "Moved in",
    tone: "transfer",
    value: s * total.movedIn,
  };
  const out: Part = {
    flow: "spent",
    label: words.out,
    tone: asset ? "expense" : "income",
    value: s * total.spent,
  };
  const movedOut: Part = {
    flow: "movedOut",
    label: "Moved out",
    tone: "transfer",
    value: s * total.movedOut,
  };
  const four =
    s > 0 ? [into, movedIn, out, movedOut] : [out, movedOut, into, movedIn];
  const extra: Part[] = [
    {
      flow: "opening",
      label: "Opening balance",
      tone: "neutral",
      value: s * total.opening,
    },
    {
      flow: "adjusted",
      label: "Reconciled",
      tone: "neutral",
      value: s * total.adjusted,
    },
  ];
  return [
    ...four.map((t, i) => ({ ...t, up: i < 2 })),
    ...extra
      .filter((t) => Math.abs(t.value) > CENT)
      .map((t) => ({ ...t, up: t.value > 0 })),
  ];
}

export function reconciledThrough(list: Move[]): string | null {
  return list.findLast((m) => m.reconciled)?.date ?? null;
}

export function viewOf(cur: Omit<Money, "amount">) {
  const rate = cur.code === display.code ? null : display.rate(cur.code);
  const shown = rate === null ? cur : display.target;
  const mark = rate === null ? "" : "≈";
  return {
    axis: (value: number) => compactMoney(value, shown.symbol ?? ""),
    format: (value: number, signed = false) =>
      `${mark}${formatMoney({ ...shown, amount: value }, signed)}`,
    rate: rate ?? 1,
  };
}
