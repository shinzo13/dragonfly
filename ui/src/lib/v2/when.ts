import { addDays, parse, today } from "#lib/dates.js";

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short" });
const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const long = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" });
const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
const range = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("en-GB", { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short" });

export function dayLabel(iso: string): string {
  const now = today();
  if (iso === now) {
    return "Today";
  }
  if (iso === addDays(now, -1)) {
    return "Yesterday";
  }
  return day.format(parse(iso)).replace(/,/, ",");
}

export const shortDate = (iso: string) => short.format(parse(iso));
export const longDate = (iso: string) => long.format(parse(iso));
export const dateTime = (value: string) => time.format(new Date(value));

export function periodName(start: string, end: string, short = false): string {
  const s = parse(start);
  const e = parse(end);
  const firstDay = s.getDate() === 1;
  const lastDay = addDays(end, 1).endsWith("-01");
  if (firstDay && lastDay && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return (short ? monthShort : month).format(s);
  }
  if (firstDay && lastDay && start.slice(5) === "01-01" && end.slice(5) === "12-31" && s.getFullYear() === e.getFullYear()) {
    return String(s.getFullYear());
  }
  return range.formatRange(s, e);
}

export function daysIn(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push(d);
  }
  return out;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}
