import {
  addDays,
  iso,
  parse,
  periodOf,
  type Range,
  shiftPeriod,
  today,
} from "#lib/dates.js";

export type ReportType =
  | "default"
  | "audit"
  | "budget"
  | "category"
  | "tag"
  | "double";

export type ListKind = "budget" | "category" | "tag" | "double";

export interface ReportKind {
  label: string;
  list?: ListKind;
  type: ReportType;
}

export const REPORT_KINDS: ReportKind[] = [
  { label: "Default financial report", type: "default" },
  { label: "Transaction history overview (audit)", type: "audit" },
  { label: "Budget report", list: "budget", type: "budget" },
  { label: "Category report", list: "category", type: "category" },
  { label: "Tag report", list: "tag", type: "tag" },
  { label: "Expense/revenue account report", list: "double", type: "double" },
];

export const LIST_LABELS: Record<ListKind, { one: string; many: string }> = {
  budget: { many: "Budgets", one: "budget" },
  category: { many: "Categories", one: "category" },
  double: { many: "Expense/revenue accounts", one: "account" },
  tag: { many: "Tags", one: "tag" },
};

export const ALL_ASSETS = "allAssetAccounts";

export interface ReportParams {
  accounts: string[];
  end: string;
  items: string[];
  start: string;
  type: ReportType;
}

export type Parsed =
  | { ok: true; params: ReportParams }
  | { ok: false; error: string };

const YMD = /^(\d{4})(\d{2})(\d{2})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const LIST_ITEM = /^[^,/]+$/;

export const kindOf = (type: string) =>
  REPORT_KINDS.find((kind) => kind.type === type);

export const ymd = (value: string) => value.replaceAll("-", "");

function valid(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return iso(date);
}

export function fiscalYear(value: string, fiscalStart = "01-01"): Range {
  const [month, day] = fiscalStart.split("-").map(Number);
  const year = Number(value.slice(0, 4));
  const thisYear = iso(new Date(year, (month || 1) - 1, day || 1));
  const startYear = thisYear <= value ? year : year - 1;
  const start = iso(new Date(startYear, (month || 1) - 1, day || 1));
  const next = iso(new Date(startYear + 1, (month || 1) - 1, day || 1));
  return { end: addDays(next, -1), start };
}

function magic(now: string, fiscalStart: string): Record<string, string> {
  const d = parse(now);
  const y = d.getFullYear();
  const m = d.getMonth();
  const fiscal = fiscalYear(now, fiscalStart);
  const previousFiscal = fiscalYear(addDays(fiscal.start, -1), fiscalStart);
  return {
    currentFiscalYearEnd: fiscal.end,
    currentFiscalYearStart: fiscal.start,
    currentMonthEnd: iso(new Date(y, m + 1, 0)),
    currentMonthStart: iso(new Date(y, m, 1)),
    currentYearEnd: `${y}-12-31`,
    currentYearStart: `${y}-01-01`,
    previousFiscalYearEnd: previousFiscal.end,
    previousFiscalYearStart: previousFiscal.start,
    previousMonthEnd: iso(new Date(y, m, 0)),
    previousMonthStart: iso(new Date(y, m - 1, 1)),
    previousYearEnd: `${y - 1}-12-31`,
    previousYearStart: `${y - 1}-01-01`,
  };
}

export function parseReportDate(
  value: string,
  fiscalStart = "01-01",
  now = today()
): string | null {
  const word = magic(now, fiscalStart)[value];
  if (word) {
    return word;
  }
  const match = YMD.exec(value) ?? ISO.exec(value);
  if (!match) {
    return null;
  }
  return valid(Number(match[1]), Number(match[2]), Number(match[3]));
}

function list(segment: string | undefined): string[] | null {
  if (!segment) {
    return null;
  }
  const items = segment
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 && items.every((item) => LIST_ITEM.test(item))
    ? [...new Set(items)]
    : null;
}

export function parseReport(
  type: string,
  rest: string,
  fiscalStart = "01-01",
  now = today()
): Parsed {
  const kind = kindOf(type);
  if (!kind) {
    return { error: `There is no "${type}" report.`, ok: false };
  }
  const segments = rest.split("/").filter(Boolean);
  const expected = kind.list ? 4 : 3;
  if (segments.length !== expected) {
    return { error: "This report address is incomplete.", ok: false };
  }
  const accounts = list(segments[0]);
  const items = kind.list ? list(segments[1]) : [];
  let start = parseReportDate(segments.at(-2) ?? "", fiscalStart, now);
  let end = parseReportDate(segments.at(-1) ?? "", fiscalStart, now);
  if (!accounts) {
    return { error: "Please select at least one asset account", ok: false };
  }
  if (!items) {
    return {
      error: `Please select at least one ${LIST_LABELS[kind.list as ListKind].one}`,
      ok: false,
    };
  }
  if (!(start && end)) {
    return {
      error: "The dates in this report address are not valid.",
      ok: false,
    };
  }
  if (end < start) {
    if (type !== "double") {
      return {
        error: "End date of report must be after start date.",
        ok: false,
      };
    }
    [start, end] = [end, start];
  }
  return { ok: true, params: { accounts, end, items, start, type: kind.type } };
}

export function reportPath(params: ReportParams): string {
  const parts = [
    "/reports",
    params.type,
    params.accounts.join(","),
    ...(kindOf(params.type)?.list ? [params.items.join(",")] : []),
    ymd(params.start),
    ymd(params.end),
  ];
  return parts.join("/");
}

export function missing(params: ReportParams): string | null {
  if (params.accounts.length === 0) {
    return "Please select at least one asset account";
  }
  const kind = kindOf(params.type);
  if (kind?.list && params.items.length === 0) {
    return kind.list === "double"
      ? "Please select at least one combination of expense/revenue accounts. If you have none (the list is empty) this report is not available."
      : `Please select at least one ${LIST_LABELS[kind.list].one}`;
  }
  if (!(params.start && params.end)) {
    return "Please choose a date range";
  }
  if (params.end < params.start) {
    return "End date of report must be after start date.";
  }
  return null;
}

export type Grain = "day" | "month" | "year";
export type Template = "month" | "year" | "multi-year";

const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function monthsBetween(start: string, end: string): number {
  const a = parse(start);
  const b = parse(end);
  const whole =
    (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  const days = b.getDate() - a.getDate();
  return whole + days / daysIn(a.getFullYear(), a.getMonth());
}

const GRAIN_EPSILON = 0.001;

export function grainOf(start: string, end: string): Grain {
  const months = monthsBetween(start, end);
  if (months >= 12 + GRAIN_EPSILON) {
    return "year";
  }
  return months >= 1 + GRAIN_EPSILON ? "month" : "day";
}

export function templateOf(start: string, end: string): Template {
  const months = monthsBetween(start, end);
  if (months > 12) {
    return "multi-year";
  }
  return months > 1 ? "year" : "month";
}

const ALIGNED_VIEWS = ["1Y", "6M", "3M", "1M"] as const;

export function shiftRange(range: Range, dir: 1 | -1): Range {
  for (const view of ALIGNED_VIEWS) {
    const aligned = periodOf(range.start, view);
    if (aligned.start === range.start && aligned.end === range.end) {
      return shiftPeriod(range, view, dir);
    }
  }
  return shiftPeriod(range, "1M", dir);
}

export interface RangePreset {
  key: string;
  label: string;
  range: Range;
}

export function rangePresets(now = today()): RangePreset[] {
  const month = periodOf(now, "1M");
  const year = periodOf(now, "1Y");
  return [
    { key: "this-month", label: "This month", range: month },
    {
      key: "last-month",
      label: "Last month",
      range: shiftPeriod(month, "1M", -1),
    },
    { key: "this-year", label: "This year", range: year },
    {
      key: "last-year",
      label: "Last year",
      range: shiftPeriod(year, "1Y", -1),
    },
  ];
}
