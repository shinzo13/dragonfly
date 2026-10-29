import type { Recurrence } from "#lib/api/types.js";
import { dateOnly } from "#lib/components/misc/queries.js";
import { parse, today } from "#lib/dates.js";
import { currentLocale, formatDate } from "#lib/format.js";

export const TYPES: Record<string, string> = {
  deposit: "Deposit",
  transfer: "Transfer",
  withdrawal: "Withdrawal",
};

export const TONES = {
  deposit: "income",
  transfer: "transfer",
  withdrawal: "expense",
} as const;

export const toneOf = (type?: string) =>
  TONES[(type ?? "withdrawal") as keyof typeof TONES] ?? "neutral";

export function endsText(r: Recurrence): string {
  if (r.repeat_until) {
    return `Repeats until ${formatDate(dateOnly(r.repeat_until))}`;
  }
  if (r.nr_of_repetitions) {
    return r.nr_of_repetitions === 1
      ? "Repeats 1 time"
      : `Repeats ${r.nr_of_repetitions} times`;
  }
  return "Repeats forever";
}

export function stopped(r: Recurrence): boolean {
  return Boolean(r.repeat_until && r.repeat_until.slice(0, 10) < today());
}

export function upcoming(r: Recurrence, count = 3): string[] {
  const now = today();
  const dates = (r.repetitions ?? [])
    .flatMap((rep) => rep.occurrences ?? [])
    .map((date) => date.slice(0, 10))
    .filter((date) => date >= now);
  return [...new Set(dates)].sort().slice(0, count);
}

type Repetition = NonNullable<Recurrence["repetitions"]>[number];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const WEEKEND: Record<number, string> = {
  2: ", skipped on weekends",
  3: ", moved to Friday on weekends",
  4: ", moved to Monday on weekends",
};
const SUFFIX = ["th", "st", "nd", "rd"];

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (SUFFIX[n % 10] ?? "th")}`;
}

function every(unit: string, skip = 0): string {
  if (skip === 0) {
    return `Every ${unit}`;
  }
  return skip === 1
    ? `Every other ${unit}`
    : `Every ${ordinal(skip + 1)} ${unit}`;
}

function base(rep: Repetition): string {
  const day = (value: string | number) =>
    DAYS[Number(value) - 1] ?? String(value);
  switch (rep.type) {
    case "daily":
      return every("day", rep.skip);
    case "weekly":
      return `${every("week", rep.skip)} on ${day(rep.moment)}`;
    case "monthly":
      return `${every("month", rep.skip)} on the ${ordinal(Number(rep.moment))}`;
    case "ndom": {
      const [week, weekday] = rep.moment.split(",");
      return `${every("month", rep.skip)} on the ${ordinal(Number(week))} ${day(weekday)}`;
    }
    case "yearly":
      return `${every("year", rep.skip)} on ${new Intl.DateTimeFormat(currentLocale(), { day: "numeric", month: "long" }).format(parse(rep.moment))}`;
    default:
      return rep.description ?? rep.type;
  }
}

export function describe(rep: Repetition): string {
  return `${base(rep)}${WEEKEND[rep.weekend ?? 1] ?? ""}`;
}
