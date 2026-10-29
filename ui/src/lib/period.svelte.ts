import { api } from "#lib/api/client.js";
import type { Page, TransactionGroup } from "#lib/api/types.js";
import {
  addDays,
  isDynamic,
  periodOf,
  type Range,
  stepPeriod,
  today,
  type ViewRange,
} from "#lib/dates.js";
import { formatDate, formatRange } from "#lib/format.js";

const STORAGE_KEY = "ffui.period";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface Preset {
  hint?: string;
  key?: string;
  label: string;
  range: Range;
}

function stored(): Range | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    return ISO_DATE.test(value?.start) && ISO_DATE.test(value?.end)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function rangeFromUrl(url: {
  searchParams: { get: (name: string) => string | null };
}): Range | null {
  const start = url.searchParams.get("start") ?? "";
  const end = url.searchParams.get("end") ?? "";
  return ISO_DATE.test(start) && ISO_DATE.test(end) && start <= end
    ? { end, start }
    : null;
}

export function periodLabel(range: Range, view: ViewRange): string {
  const aligned = periodOf(range.start, isDynamic(view) ? "1M" : view);
  if (aligned.start === range.start && aligned.end === range.end) {
    if (view === "1M" || isDynamic(view)) {
      return formatDate(range.start, "month");
    }
    if (view === "1Y") {
      return formatDate(range.start, "year");
    }
  }
  return formatRange(range.start, range.end);
}

class Period {
  view = $state<ViewRange>("1M");
  start = $state(today());
  end = $state(today());
  first = $state<string | null>(null);
  ready = $state(false);

  range = $derived<Range>({ end: this.end, start: this.start });
  label = $derived(periodLabel(this.range, this.view));
  isCurrent = $derived(this.start <= today() && today() <= this.end);

  init(view: ViewRange, url: Parameters<typeof rangeFromUrl>[0]) {
    this.view = view;
    const range = rangeFromUrl(url) ?? stored() ?? periodOf(today(), view);
    this.start = range.start;
    this.end = range.end;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(range));
    this.ready = true;
  }

  async loadFirst() {
    const query = { end: today(), limit: 1, start: "1970-01-02", type: "all" };
    const head = await api<Page<TransactionGroup>>("/v1/transactions", {
      query,
    });
    const pages = head.meta.pagination?.total_pages ?? 0;
    if (pages === 0) {
      return;
    }
    const last = await api<Page<TransactionGroup>>("/v1/transactions", {
      query: { ...query, page: pages },
    });
    const date = last.data[0]?.attributes.transactions[0]?.date;
    this.first = date ? date.slice(0, 10) : null;
  }

  set(range: Range) {
    if (range.start === this.start && range.end === this.end) {
      return;
    }
    this.start = range.start;
    this.end = range.end;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(range));
  }

  shift(dir: 1 | -1) {
    this.set(stepPeriod(this.range, this.view, dir));
  }

  reset() {
    this.set(periodOf(today(), this.view));
  }

  presets(): Preset[] {
    const now = today();
    const { view } = this;
    const presets: Preset[] = [];
    if (!isDynamic(view)) {
      const prev = stepPeriod(this.range, view, -1);
      const next = stepPeriod(this.range, view, 1);
      presets.push({ hint: "[", label: periodLabel(prev, view), range: prev });
      presets.push({ hint: "]", label: periodLabel(next, view), range: next });
    }
    const current = periodOf(now, view);
    presets.push({
      key: "t",
      label: `Today (${periodLabel(current, view)})`,
      range: current,
    });
    presets.push({
      key: "7",
      label: "Last seven days",
      range: { end: now, start: addDays(now, -7) },
    });
    presets.push({
      key: "3",
      label: "Last thirty days",
      range: { end: now, start: addDays(now, -30) },
    });
    presets.push({
      key: "m",
      label: "Month to date",
      range: periodOf(now, "MTD"),
    });
    presets.push({
      key: "y",
      label: "Year to date",
      range: periodOf(now, "YTD"),
    });
    const year = Number(now.slice(0, 4)) - 1;
    presets.push({
      key: "l",
      label: `Previous year (${year})`,
      range: { end: `${year}-12-31`, start: `${year}-01-01` },
    });
    if (this.first) {
      presets.push({
        key: "a",
        label: "Everything",
        range: { end: now, start: this.first },
      });
    }
    return presets;
  }
}

export const period = new Period();
