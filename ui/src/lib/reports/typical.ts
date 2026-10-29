import { today } from "#lib/dates.js";
import { percent } from "#lib/format.js";
import type { Flow } from "./flows.js";

export const TYPICAL_MONTHS = 12;
const SAME = 0.03;

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function typicalMonths(
  months: string[],
  now = today(),
  since = ""
): string[] {
  const current = now.slice(0, 7);
  const first = since.slice(0, 7);
  return months
    .filter((month) => month < current && month >= first)
    .slice(-TYPICAL_MONTHS);
}

export function series(
  flows: Iterable<Flow>,
  keyOf: (flow: Flow) => string | null,
  measure: (flow: Flow) => number = (flow) => flow.amount
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const flow of flows) {
    const key = keyOf(flow);
    if (key === null) {
      continue;
    }
    let months = result.get(key);
    if (!months) {
      months = new Map();
      result.set(key, months);
    }
    const month = flow.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + measure(flow));
  }
  return result;
}

export function typical(
  byMonth: ReadonlyMap<string, number> | undefined,
  months: string[]
): number {
  return median(months.map((month) => byMonth?.get(month) ?? 0));
}

export function typicalToDay(
  flows: Iterable<Flow>,
  months: string[],
  day: number
): number {
  const sums = new Map(months.map((month) => [month, 0]));
  for (const flow of flows) {
    const month = flow.date.slice(0, 7);
    const sum = sums.get(month);
    if (sum !== undefined && Number(flow.date.slice(8, 10)) <= day) {
      sums.set(month, sum + flow.amount);
    }
  }
  return median([...sums.values()]);
}

export interface Pace {
  day: number;
  month: string;
  sofar: number;
  typical: number;
}

export function pace(
  flows: Iterable<Flow>,
  months: string[],
  now = today()
): Pace {
  const month = now.slice(0, 7);
  const day = Number(now.slice(8, 10));
  let sofar = 0;
  const past: Flow[] = [];
  for (const flow of flows) {
    if (flow.date.slice(0, 7) === month) {
      sofar += flow.date <= now ? flow.amount : 0;
    } else {
      past.push(flow);
    }
  }
  return { day, month, sofar, typical: typicalToDay(past, months, day) };
}

export function versus(value: number, base: number): number | null {
  return base > 0 ? (value - base) / base : null;
}

export function versusText(ratio: number | null, noun = "typical"): string {
  if (ratio === null) {
    return "";
  }
  if (Math.abs(ratio) < SAME) {
    return noun ? `about ${noun}` : "about the same";
  }
  const side = ratio > 0 ? "above" : "below";
  return `${percent(Math.abs(ratio))} ${side}${noun ? ` ${noun}` : ""}`;
}
