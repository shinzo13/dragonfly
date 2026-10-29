export interface Range {
  end: string;
  start: string;
}

export type ViewRange =
  | "1D"
  | "1W"
  | "last7"
  | "1M"
  | "last30"
  | "MTD"
  | "3M"
  | "last90"
  | "QTD"
  | "6M"
  | "1Y"
  | "YTD"
  | "last365";

const DYNAMIC = new Set<ViewRange>([
  "last7",
  "last30",
  "last90",
  "last365",
  "MTD",
  "QTD",
  "YTD",
]);

const pad = (n: number) => String(n).padStart(2, "0");

export const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parse(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => iso(new Date());

export function addDays(value: string, days: number): string {
  const d = parse(value);
  d.setDate(d.getDate() + days);
  return iso(d);
}

export function addMonths(value: string, months: number): string {
  const d = parse(value);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return iso(d);
}

export const isDynamic = (view: ViewRange) => DYNAMIC.has(view);

function startOf(value: string, view: ViewRange): string {
  const d = parse(value);
  switch (view) {
    case "1D":
      return value;
    case "1W": {
      const shift = (d.getDay() + 6) % 7;
      return addDays(value, -shift);
    }
    case "3M":
      return iso(
        new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
      );
    case "6M":
      return iso(new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1));
    case "1Y":
      return iso(new Date(d.getFullYear(), 0, 1));
    default:
      return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  }
}

const LENGTH_MONTHS: Partial<Record<ViewRange, number>> = {
  "1M": 1,
  "1Y": 12,
  "3M": 3,
  "6M": 6,
};

export function periodOf(value: string, view: ViewRange): Range {
  const now = today();
  switch (view) {
    case "last7":
      return { end: now, start: addDays(now, -7) };
    case "last30":
      return { end: now, start: addDays(now, -30) };
    case "last90":
      return { end: now, start: addDays(now, -90) };
    case "last365":
      return { end: now, start: addDays(now, -365) };
    case "MTD":
      return { end: now, start: startOf(now, "1M") };
    case "QTD":
      return { end: now, start: startOf(now, "3M") };
    case "YTD":
      return { end: now, start: startOf(now, "1Y") };
    case "1D":
      return { end: value, start: value };
    case "1W": {
      const start = startOf(value, "1W");
      return { end: addDays(start, 6), start };
    }
    default: {
      const start = startOf(value, view);
      const months = LENGTH_MONTHS[view] ?? 1;
      return { end: addDays(addMonths(start, months), -1), start };
    }
  }
}

const UNITS: ViewRange[] = ["1M", "3M", "6M", "1Y"];

function unitOf(range: Range, view: ViewRange): ViewRange | null {
  const units = isDynamic(view) ? UNITS : [view, ...UNITS];
  return (
    units.find((unit) => {
      const aligned = periodOf(range.start, unit);
      return aligned.start === range.start && range.end <= aligned.end;
    }) ?? null
  );
}

function wholeMonths(range: Range): number {
  const after = addDays(range.end, 1);
  if (!(range.start.endsWith("-01") && after.endsWith("-01"))) {
    return 0;
  }
  const months = (value: string) =>
    Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  return months(after) - months(range.start);
}

function calendarShift(
  range: Range,
  view: ViewRange,
  dir: 1 | -1
): Range | null {
  const unit = unitOf(range, view);
  if (unit) {
    const anchor = dir === 1 ? periodOf(range.start, unit).end : range.start;
    return periodOf(addDays(anchor, dir), unit);
  }
  const months = wholeMonths(range);
  if (months === 0) {
    return null;
  }
  const start = addMonths(range.start, dir * months);
  return { end: addDays(addMonths(start, months), -1), start };
}

export function shiftPeriod(range: Range, view: ViewRange, dir: 1 | -1): Range {
  const calendar = calendarShift(range, view, dir);
  if (calendar) {
    return calendar;
  }
  const days = daysBetween(range.start, range.end) + 1;
  return {
    end: addDays(range.end, dir * days),
    start: addDays(range.start, dir * days),
  };
}

export function stepPeriod(range: Range, view: ViewRange, dir: 1 | -1): Range {
  const calendar = calendarShift(range, view, dir);
  if (calendar) {
    return calendar;
  }
  const unit = isDynamic(view) ? "1M" : view;
  const edge = dir === 1 ? range.end : range.start;
  const own = periodOf(edge, unit);
  const reached = (dir === 1 ? own.end : own.start) === edge;
  return reached ? periodOf(addDays(edge, dir), unit) : own;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function eachDay(range: Range): string[] {
  const days: string[] = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

export function contains(range: Range, value: string): boolean {
  const day = value.slice(0, 10);
  return day >= range.start && day <= range.end;
}
