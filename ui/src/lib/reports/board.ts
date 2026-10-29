import {
  type Lane,
  OTHER_COLOR,
  type StackKey,
  seriesColor,
} from "#lib/components/charts/chart.js";
import { addMonths, periodOf, type Range, today } from "#lib/dates.js";
import { formatDate } from "#lib/format.js";
import { session } from "#lib/session.svelte.js";
import { buckets, type Flow, keys, NONE } from "./flows.js";
import { money } from "./report.svelte.js";
import {
  type Pace,
  pace,
  series,
  typical,
  typicalMonths,
  typicalToDay,
  versus,
} from "./typical.js";
import { modeAxis } from "./view.js";

export const OTHER = "other";
const NO_CATEGORY_COLOR = "var(--cladd-fg-softer)";
const MAX_CATEGORIES = 6;
const TOP_PLACES = 3;

export const monthOf = (date: string) => date.slice(0, 7);

export const shiftMonth = (month: string, delta: number) =>
  monthOf(addMonths(`${month}-01`, delta));

export const monthRange = (month: string): Range =>
  periodOf(`${month}-01`, "1M");

export function cursorOf(range: Range, now = today()): string {
  const start = monthOf(range.start);
  if (start === monthOf(range.end)) {
    return start;
  }
  if (range.start <= now && now <= range.end) {
    return monthOf(now);
  }
  return monthOf(range.end) > monthOf(now) ? monthOf(now) : monthOf(range.end);
}

export const shortMonth = (month: string) =>
  new Intl.DateTimeFormat(session.locale, { month: "short" }).format(
    new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
  );

export const longMonth = (month: string) => formatDate(`${month}-01`, "month");

const ordinals = new Intl.PluralRules("en", { type: "ordinal" });
const SUFFIX: Record<string, string> = {
  few: "rd",
  one: "st",
  other: "th",
  two: "nd",
};

export const ordinal = (n: number) => `${n}${SUFFIX[ordinals.select(n)]}`;

const key = (code: string, part: string) => `${code} ${part}`;

export interface Board {
  categories: Map<string, Map<string, number>>;
  catKeys: StackKey[];
  catLabel: Map<string, string>;
  codes: string[];
  earned: Map<string, Map<string, number>>;
  months: string[];
  now: string;
  partial: string | null;
  primary: string;
  spending: Flow[];
  spent: Map<string, Map<string, number>>;
  stackOf: (flow: Flow) => string;
  stacks: Map<string, Map<string, number>>;
  typical: Map<string, number>;
  typicalMonths: string[];
}

function rankCategories(spending: Flow[], months: Set<string>) {
  const totals = new Map<string, number>();
  const byCat = new Map<string, number>();
  const labels = new Map<string, string>([
    [NONE, "(no category)"],
    [OTHER, "Other"],
  ]);
  for (const flow of spending) {
    if (!months.has(monthOf(flow.date))) {
      continue;
    }
    const cat = keys.category(flow);
    labels.set(cat.key, cat.label);
    totals.set(flow.currency, (totals.get(flow.currency) ?? 0) + flow.amount);
    const k = key(flow.currency, cat.key);
    byCat.set(k, (byCat.get(k) ?? 0) + flow.amount);
  }
  const score = new Map<string, number>();
  for (const [k, value] of byCat) {
    const [code, cat] = [
      k.slice(0, k.indexOf(" ")),
      k.slice(k.indexOf(" ") + 1),
    ];
    score.set(cat, (score.get(cat) ?? 0) + value / (totals.get(code) || 1));
  }
  const ranked = [...score.entries()]
    .filter(([cat]) => cat !== NONE)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
  const top = new Set(ranked.slice(0, MAX_CATEGORIES));
  const catKeys: StackKey[] = [...top].map((cat, i) => ({
    color: seriesColor(i),
    key: cat,
    label: labels.get(cat) ?? cat,
  }));
  if (score.has(NONE)) {
    catKeys.push({
      color: NO_CATEGORY_COLOR,
      key: NONE,
      label: labels.get(NONE) ?? "",
    });
  }
  if (ranked.length > top.size) {
    catKeys.push({ color: OTHER_COLOR, key: OTHER, label: "Other" });
  }
  const stackOf = (flow: Flow) => {
    const cat = flow.category?.id ?? NONE;
    return cat === NONE || top.has(cat) ? cat : OTHER;
  };
  return { catKeys, labels, stackOf };
}

export function buildBoard(
  flows: Flow[],
  windowMonths: string[],
  year: string,
  order: string[],
  now = today()
): Board {
  const months = buckets(`${year}-01-01`, `${year}-12-31`, "month");
  const closed = year < now.slice(0, 4) ? `${Number(year) + 1}-01-01` : now;
  const first = flows.reduce(
    (min, flow) => (flow.date < min ? flow.date : min),
    "9999"
  );
  const typMonths = typicalMonths(windowMonths, closed, first);
  const spending = flows.filter((flow) => flow.dir === -1);
  const spent = series(spending, (flow) => flow.currency);
  const earned = series(
    flows.filter((flow) => flow.dir === 1),
    (flow) => flow.currency
  );
  const shown = new Set([...months, ...typMonths]);
  const { catKeys, labels, stackOf } = rankCategories(
    spending,
    new Set(months)
  );
  const counts = new Map<string, number>();
  for (const flow of flows) {
    if (shown.has(monthOf(flow.date))) {
      counts.set(flow.currency, (counts.get(flow.currency) ?? 0) + 1);
    }
  }
  const primary = order[0] ?? "";
  const rank = (code: string) => (code === primary ? 0 : 1);
  const codes = [...counts.keys()].sort(
    (a, b) => rank(a) - rank(b) || (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  );
  return {
    categories: series(spending, (flow) =>
      key(flow.currency, keys.category(flow).key)
    ),
    catKeys,
    catLabel: labels,
    codes,
    earned,
    months,
    now,
    partial: months.includes(monthOf(now)) ? monthOf(now) : null,
    primary,
    spending,
    spent,
    stackOf,
    stacks: series(spending, (flow) => key(flow.currency, stackOf(flow))),
    typical: new Map(
      codes.map((code) => [code, typical(spent.get(code), typMonths)])
    ),
    typicalMonths: typMonths,
  };
}

const QUIET_HEIGHT = 56;

export function spendingLanes(board: Board): Lane[] {
  return board.codes.map((code) => ({
    axisFormat: modeAxis(code),
    dots: Object.fromEntries(
      board.months.map((month) => [
        month,
        board.earned.get(code)?.get(month) ?? 0,
      ])
    ),
    format: (value: number) => money(code, value, false, 0),
    height: board.typical.get(code) ? undefined : QUIET_HEIGHT,
    key: code,
    keys: board.catKeys,
    label: code,
    rows: board.months.map((month) => ({
      key: month,
      label: shortMonth(month),
      values: Object.fromEntries(
        board.catKeys.map((k) => [
          k.key,
          board.stacks.get(key(code, k.key))?.get(month) ?? 0,
        ])
      ),
    })),
    typical: board.typical.get(code) ?? null,
  }));
}

export function mergedLane(board: Board): Lane {
  const code = board.primary;
  const pc = (flow: Flow) => flow.pc ?? 0;
  const stacks = series(board.spending, board.stackOf, pc);
  const spent = series(board.spending, () => code, pc).get(code);
  return {
    axisFormat: modeAxis(code),
    format: (value: number) => money(code, value, false, 0),
    key: "pc",
    keys: board.catKeys,
    label: `≈${code}`,
    rows: board.months.map((month) => ({
      key: month,
      label: shortMonth(month),
      values: Object.fromEntries(
        board.catKeys.map((k) => [k.key, stacks.get(k.key)?.get(month) ?? 0])
      ),
    })),
    typical: typical(spent, board.typicalMonths),
  };
}

const sumOf = (byMonth: Map<string, number> | undefined, months: string[]) =>
  months.reduce((sum, month) => sum + (byMonth?.get(month) ?? 0), 0);

export interface Headline {
  code: string;
  earned: number;
  pace: Pace | null;
  spent: number;
  typical: number;
}

export function headlines(board: Board, months = board.months): Headline[] {
  return board.codes.map((code) => ({
    code,
    earned: sumOf(board.earned.get(code), months),
    pace:
      board.partial && months.includes(board.partial)
        ? pace(
            board.spending.filter((flow) => flow.currency === code),
            board.typicalMonths,
            board.now
          )
        : null,
    spent: sumOf(board.spent.get(code), months),
    typical: board.typical.get(code) ?? 0,
  }));
}

export interface Grew {
  cat: string;
  code: string;
  impact: number;
  key: string;
  label: string;
  month: number;
  ratio: number | null;
  typical: number;
  values: number[];
  year: number;
}

export function grew(board: Board, month: string): Grew[] {
  const partial = month === board.partial;
  const day = Number(board.now.slice(8, 10));
  const lastMonth = board.partial ?? board.months.at(-1) ?? month;
  const months = board.months.filter((m) => m <= lastMonth);
  const byKey = new Map<string, Flow[]>();
  if (partial) {
    for (const flow of board.spending) {
      const k = key(flow.currency, keys.category(flow).key);
      const list = byKey.get(k) ?? [];
      list.push(flow);
      byKey.set(k, list);
    }
  }
  const rows: Grew[] = [];
  for (const [k, byMonth] of board.categories) {
    const split = k.indexOf(" ");
    const code = k.slice(0, split);
    const cat = k.slice(split + 1);
    const base = board.typical.get(code) || 1;
    const now = partial
      ? (byKey.get(k) ?? [])
          .filter((f) => monthOf(f.date) === month && f.date <= board.now)
          .reduce((sum, f) => sum + f.amount, 0)
      : (byMonth.get(month) ?? 0);
    const typ = partial
      ? typicalToDay(byKey.get(k) ?? [], board.typicalMonths, day)
      : typical(byMonth, board.typicalMonths);
    const year = sumOf(byMonth, board.months);
    if (now === 0 && typ === 0 && year === 0) {
      continue;
    }
    rows.push({
      cat,
      code,
      impact: (now - typ) / base,
      key: k,
      label: board.catLabel.get(cat) ?? cat,
      month: now,
      ratio: versus(now, typ),
      typical: typ,
      values: months.map((m) => byMonth.get(m) ?? 0),
      year,
    });
  }
  return rows.sort((a, b) => b.impact - a.impact);
}

export interface Place {
  count: number;
  id: string;
  name: string;
  value: number;
}

export interface MonthFacts {
  code: string;
  day: { date: string; value: number; where: string; count: number } | null;
  earned: number;
  places: Place[];
  ratio: number | null;
  spent: number;
}

export function monthFacts(board: Board, month: string): MonthFacts[] {
  const partial = month === board.partial;
  return board.codes.map((code) => {
    const flows = board.spending.filter(
      (flow) => flow.currency === code && monthOf(flow.date) === month
    );
    const places = new Map<string, Place>();
    const days = new Map<string, Flow[]>();
    for (const flow of flows) {
      const place = places.get(flow.other.id) ?? {
        count: 0,
        id: flow.other.id,
        name: flow.other.name,
        value: 0,
      };
      place.count += 1;
      place.value += flow.amount;
      places.set(flow.other.id, place);
      const list = days.get(flow.date) ?? [];
      list.push(flow);
      days.set(flow.date, list);
    }
    let day: MonthFacts["day"] = null;
    for (const [date, list] of days) {
      const value = list.reduce((sum, f) => sum + f.amount, 0);
      if (!day || value > day.value) {
        const top = list.reduce((a, b) => (b.amount > a.amount ? b : a));
        day = { count: list.length, date, value, where: top.other.name };
      }
    }
    const spent = board.spent.get(code)?.get(month) ?? 0;
    const p = partial
      ? pace(
          board.spending.filter((flow) => flow.currency === code),
          board.typicalMonths,
          board.now
        )
      : null;
    return {
      code,
      day,
      earned: board.earned.get(code)?.get(month) ?? 0,
      places: [...places.values()]
        .sort((a, b) => b.value - a.value)
        .slice(0, TOP_PLACES),
      ratio: p
        ? versus(p.sofar, p.typical)
        : versus(spent, board.typical.get(code) ?? 0),
      spent,
    };
  });
}
