import type { Bill, Item } from "#lib/api/types.js";
import {
  addDays,
  addMonths,
  daysBetween,
  type Range,
  today,
} from "#lib/dates.js";
import type { Money } from "#lib/format.js";
import { toNumber } from "#lib/format.js";

export const FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "half-year",
  "yearly",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

const PER_YEAR: Record<Frequency, number> = {
  "half-year": 2,
  monthly: 12,
  quarterly: 4,
  weekly: 52.17,
  yearly: 1,
};

const MONTHS_PER: Record<Frequency, number> = {
  "half-year": 6,
  monthly: 1,
  quarterly: 3,
  weekly: 0,
  yearly: 12,
};

const UNIT: Record<Frequency, [string, string]> = {
  "half-year": ["every half year", "half years"],
  monthly: ["monthly", "months"],
  quarterly: ["quarterly", "quarters"],
  weekly: ["weekly", "weeks"],
  yearly: ["yearly", "years"],
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  "half-year": "Every half year",
  monthly: "Monthly",
  quarterly: "Quarterly",
  weekly: "Weekly",
  yearly: "Yearly",
};

const freq = (bill: Bill): Frequency =>
  (bill.repeat_freq ?? "monthly") as Frequency;

const DAYS_PER_MONTH = 30.4;
const WEEK = 7;

export const cycleDays = (bill: Bill) =>
  (MONTHS_PER[freq(bill)] * DAYS_PER_MONTH || WEEK) * ((bill.skip ?? 0) + 1);

export function twoCyclesAfter(bill: Bill, from: string): string {
  const cycles = 2 * ((bill.skip ?? 0) + 1);
  const months = MONTHS_PER[freq(bill)];
  return months === 0
    ? addDays(from, WEEK * cycles)
    : addMonths(from, months * cycles);
}

export const isRange = (bill: Bill) =>
  toNumber(bill.amount_min) !== toNumber(bill.amount_max);

export const average = (bill: Bill) =>
  (toNumber(bill.amount_min) + toNumber(bill.amount_max)) / 2;

export const timesPerYear = (bill: Bill) =>
  PER_YEAR[freq(bill)] / ((bill.skip ?? 0) + 1);

export function repeats(bill: Bill): string {
  const [single, plural] = UNIT[freq(bill)];
  const every = (bill.skip ?? 0) + 1;
  return every > 1 ? `every ${every} ${plural}` : single;
}

export const money = (bill: Bill, amount: number): Money => ({
  amount,
  code: bill.currency_code,
  decimals: bill.currency_decimal_places,
  symbol: bill.currency_symbol,
});

export const monthly = (bill: Bill) =>
  money(bill, (average(bill) * timesPerYear(bill)) / 12);

export const yearly = (bill: Bill) =>
  money(bill, average(bill) * timesPerYear(bill));

export const dueIn = (range: Range, bill: Bill) =>
  (bill.pay_dates ?? [])
    .map((date) => date.slice(0, 10))
    .filter((date) => date >= range.start && date <= range.end);

export type Status =
  | { kind: "inactive" }
  | { kind: "paid"; paid: NonNullable<Bill["paid_dates"]> }
  | { kind: "due" | "overdue"; date: string; days: number }
  | { kind: "none" };

export function status(bill: Bill, range: Range): Status {
  if (!bill.active) {
    return { kind: "inactive" };
  }
  const paid = bill.paid_dates ?? [];
  if (paid.length > 0) {
    return { kind: "paid", paid };
  }
  const [date] = dueIn(range, bill);
  if (!date) {
    return { kind: "none" };
  }
  const days = daysBetween(today(), date);
  return { date, days, kind: days < 0 ? "overdue" : "due" };
}

export function statusText(state: Status): string {
  switch (state.kind) {
    case "inactive":
      return "Inactive";
    case "none":
      return "Not expected this period";
    case "overdue":
      return `Overdue ${-state.days} ${-state.days === 1 ? "day" : "days"}`;
    case "due":
      if (state.days === 0) {
        return "Due today";
      }
      return `Due in ${state.days} ${state.days === 1 ? "day" : "days"}`;
    default:
      return "Paid";
  }
}

export const STATUS_TONE: Record<Status["kind"], string> = {
  due: "text-warn",
  inactive: "text-cladd-fg-softer",
  none: "text-cladd-fg-softer",
  overdue: "text-expense",
  paid: "text-income",
};

export const nextExpected = (bill: Bill) =>
  bill.pay_dates?.[0]?.slice(0, 10) ?? bill.next_expected_match ?? null;

export type Cell = "paid" | "missed" | "due" | "off" | "idle";

export function expectedIn(bill: Bill, month: string): boolean {
  const start = (bill.date ?? "").slice(0, 7);
  const end = bill.end_date?.slice(0, 7);
  if (!start || month < start || (end && month > end)) {
    return false;
  }
  const step = MONTHS_PER[freq(bill)] * ((bill.skip ?? 0) + 1);
  if (step === 0) {
    return true;
  }
  const [y1, m1] = start.split("-").map(Number);
  const [y2, m2] = month.split("-").map(Number);
  return ((y2 - y1) * 12 + (m2 - m1)) % step === 0;
}

export function lastMonths(end: string, count = 12): string[] {
  const first = addMonths(`${end.slice(0, 7)}-01`, 1 - count);
  return Array.from({ length: count }, (_, i) =>
    addMonths(first, i).slice(0, 7)
  );
}

export function strip(bill: Bill, months: string[]): Cell[] {
  const paid = new Set((bill.paid_dates ?? []).map((p) => p.date?.slice(0, 7)));
  const day = today();
  const now = day.slice(0, 7);
  const late = (bill.pay_dates ?? []).some(
    (date) => date.slice(0, 7) === now && date.slice(0, 10) < day
  );
  return months.map((month) => {
    if (paid.has(month)) {
      return "paid";
    }
    if (!(bill.active && expectedIn(bill, month))) {
      return "off";
    }
    if (month > now) {
      return "idle";
    }
    return month === now && !late ? "due" : "missed";
  });
}

export const billKey = (item: Item<Bill>) => item.id;
