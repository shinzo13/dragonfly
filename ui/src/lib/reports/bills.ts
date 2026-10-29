import type { Bill } from "#lib/api/types.js";
import { addDays, addMonths, type Range } from "#lib/dates.js";

const STEP: Record<string, (date: string, n: number) => string> = {
  "half-year": (date, n) => addMonths(date, 6 * n),
  monthly: (date, n) => addMonths(date, n),
  quarterly: (date, n) => addMonths(date, 3 * n),
  weekly: (date, n) => addDays(date, 7 * n),
  yearly: (date, n) => addMonths(date, 12 * n),
};

const LIMIT = 500;

export function expectedDates(bill: Bill, range: Range): string[] {
  const first = bill.date?.slice(0, 10);
  const step = STEP[bill.repeat_freq ?? ""];
  if (!(first && step)) {
    return [];
  }
  const every = (bill.skip ?? 0) + 1;
  const stop = bill.end_date?.slice(0, 10);
  const dates: string[] = [];
  for (let i = 0; i < LIMIT; i += 1) {
    const date = step(first, i * every);
    if (date > range.end || (stop && date > stop)) {
      break;
    }
    if (date >= range.start) {
      dates.push(date);
    }
  }
  return dates;
}
