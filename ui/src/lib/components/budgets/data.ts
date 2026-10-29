import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type {
  AvailableBudget,
  Budget,
  BudgetLimit,
  Currency,
  InsightTotalEntry,
  Item,
  Split,
} from "#lib/api/types.js";
import { placesOf, sumsOf, withoutBudget } from "#lib/budgets/triage.js";
import {
  add,
  amountIn,
  type Cur,
  fromEntries,
  list,
  type Sum,
  type Sums,
} from "#lib/components/categories/sums.js";
import {
  contains,
  daysBetween,
  isDynamic,
  type Range,
  shiftPeriod,
  today,
  type ViewRange,
} from "#lib/dates.js";
import { formatMoney, toNumber } from "#lib/format.js";
import { display } from "#lib/money/display.svelte.js";

export interface Line {
  amount: number | null;
  approx?: boolean;
  cur: Cur & { id: string };
  key: string;
  limit?: Item<BudgetLimit>;
  range: Range;
  spent: number;
}

export interface BudgetRow {
  budget: Item<Budget>;
  lines: Line[];
}

export interface Pool {
  available: number | null;
  availableRange: Range | null;
  budgeted: number;
  cur: Cur;
  spent: number;
}

export interface Top {
  approx?: boolean;
  available: number | null;
  budgeted: number;
  cur: Cur;
  inBudgets: number;
  outside: number;
  spent: number;
}

export interface Pace {
  expected: number;
  fraction: number;
  over: number;
}

export interface BudgetPage {
  available: Item<AvailableBudget>[];
  budgets: Item<Budget>[];
  limits: Item<BudgetLimit>[];
  noBudget: Sum[];
  noBudgetCount: number;
  total: Sum[];
}

export const isOpen = (split: Split) =>
  split.type === "withdrawal" && !split.budget_id;

export const day = (value: string | undefined) => (value ?? "").slice(0, 10);

export const limitRange = (limit: Item<BudgetLimit>): Range => ({
  end: day(limit.attributes.end),
  start: day(limit.attributes.start),
});

export function curOf(
  currencies: Item<Currency>[],
  code: string | undefined
): Cur & { id: string } {
  const found = currencies.find((c) => c.attributes.code === code);
  return {
    code: code ?? "",
    decimals: found?.attributes.decimal_places ?? 2,
    id: found?.id ?? "",
    symbol: found?.attributes.symbol ?? code ?? "",
  };
}

function insightSums(
  entries: InsightTotalEntry[],
  currencies: Item<Currency>[]
): Sum[] {
  const sums: Sums = {};
  for (const entry of entries) {
    add(
      sums,
      curOf(currencies, entry.currency_code),
      toNumber(entry.difference)
    );
  }
  return list(sums);
}

export async function loadBudgetPage(
  range: Range,
  currencies: Item<Currency>[]
): Promise<BudgetPage> {
  const query = { end: range.end, start: range.start };
  const [budgets, limits, available, total, groups] = await Promise.all([
    all<Budget>("/v1/budgets", query),
    all<BudgetLimit>("/v1/budget-limits", query),
    all<AvailableBudget>("/v1/available-budgets", query),
    api<InsightTotalEntry[]>("/v1/insight/expense/total", { query }),
    withoutBudget(range),
  ]);
  const entries = placesOf(groups, isOpen).flatMap((place) => place.entries);
  return {
    available,
    budgets,
    limits,
    noBudget: sumsOf(entries),
    noBudgetCount: entries.length,
    total: insightSums(total, currencies),
  };
}

const byOrder = (a: Item<Budget>, b: Item<Budget>) =>
  (a.attributes.order ?? 0) - (b.attributes.order ?? 0) ||
  a.attributes.name.localeCompare(b.attributes.name);

export function buildRows(
  data: BudgetPage,
  range: Range,
  currencies: Item<Currency>[],
  primary: string
): BudgetRow[] {
  return data.budgets
    .filter((budget) => budget.attributes.active)
    .sort(byOrder)
    .map((budget) => {
      const spent = fromEntries(budget.attributes.spent);
      const lines: Line[] = data.limits
        .filter((limit) => limit.attributes.budget_id === budget.id)
        .map((limit) => {
          const code = limit.attributes.currency_code;
          const own = fromEntries(limit.attributes.spent);
          return {
            amount: toNumber(limit.attributes.amount),
            cur: curOf(currencies, code),
            key: `${budget.id}:${limit.id}`,
            limit,
            range: limitRange(limit),
            spent: own.find((s) => s.code === code)?.amount ?? 0,
          };
        });
      for (const sum of spent) {
        if (!lines.some((line) => line.cur.code === sum.code)) {
          lines.push({
            amount: null,
            cur: curOf(currencies, sum.code),
            key: `${budget.id}:${sum.code}`,
            range,
            spent: sum.amount,
          });
        }
      }
      if (lines.length === 0) {
        lines.push({
          amount: null,
          cur: curOf(currencies, primary),
          key: `${budget.id}:${primary}`,
          range,
          spent: 0,
        });
      }
      return { budget, lines };
    });
}

export function buildPools(
  data: BudgetPage,
  rows: BudgetRow[],
  currencies: Item<Currency>[],
  primary: string
): Pool[] {
  const pools = new Map<string, Pool>();
  const pool = (code: string) => {
    let found = pools.get(code);
    if (!found) {
      found = {
        available: null,
        availableRange: null,
        budgeted: 0,
        cur: curOf(currencies, code),
        spent: 0,
      };
      pools.set(code, found);
    }
    return found;
  };
  for (const item of data.available) {
    const target = pool(item.attributes.currency_code ?? primary);
    target.available =
      (target.available ?? 0) + toNumber(item.attributes.amount);
    target.availableRange = {
      end: day(item.attributes.end),
      start: day(item.attributes.start),
    };
  }
  for (const row of rows) {
    for (const line of row.lines) {
      const target = pool(line.cur.code);
      target.budgeted += line.amount ?? 0;
      target.spent += line.spent;
    }
  }
  const result = [...pools.values()].filter(
    (p) => p.available !== null || p.budgeted !== 0 || p.spent !== 0
  );
  return result.length > 0 ? result : [pool(primary)];
}

export function topLines(
  pools: Pool[],
  total: Sum[],
  noBudget: Sum[],
  primary: string
): Top[] {
  const curs = new Map<string, Cur>();
  for (const item of [...pools.map((pool) => pool.cur), ...total]) {
    curs.set(item.code, curs.get(item.code) ?? item);
  }
  return [...curs.values()]
    .map((cur) => {
      const pool = pools.find((item) => item.cur.code === cur.code);
      return {
        available: pool?.available ?? null,
        budgeted: pool?.budgeted ?? 0,
        cur,
        inBudgets: -(pool?.spent ?? 0),
        outside: -amountIn(noBudget, cur.code),
        spent: -amountIn(total, cur.code),
      };
    })
    .filter((top) => top.budgeted || top.spent || top.available)
    .sort(
      (a, b) =>
        Number(b.cur.code === primary) - Number(a.cur.code === primary) ||
        b.spent - a.spent
    );
}

function ratesOf(codes: string[]): number[] | null {
  if (!display.active || codes.every((code) => code === display.code)) {
    return null;
  }
  const rates = codes.map((code) => display.rate(code));
  return rates.every((rate) => rate !== null) ? rates : null;
}

const scaled = (values: number[], rates: number[]) =>
  values.reduce((total, value, i) => total + value * rates[i], 0);

export function mergeLines(lines: Line[], range: Range): Line[] {
  const rates = ratesOf(lines.map((line) => line.cur.code));
  if (!rates) {
    return lines;
  }
  const limited = lines.find((line) => line.amount !== null);
  return [
    {
      amount: limited
        ? scaled(
            lines.map((line) => line.amount ?? 0),
            rates
          )
        : null,
      approx: true,
      cur: { ...display.target, id: "" },
      key: lines[0].key,
      range: limited?.range ?? range,
      spent: scaled(
        lines.map((line) => line.spent),
        rates
      ),
    },
  ];
}

export function mergeTops(tops: Top[]): Top[] {
  const rates = ratesOf(tops.map((top) => top.cur.code));
  if (!rates) {
    return tops;
  }
  const sum = (pick: (top: Top) => number) => scaled(tops.map(pick), rates);
  return [
    {
      approx: true,
      available: tops.some((top) => top.available !== null)
        ? sum((top) => top.available ?? 0)
        : null,
      budgeted: sum((top) => top.budgeted),
      cur: display.target,
      inBudgets: sum((top) => top.inBudgets),
      outside: sum((top) => top.outside),
      spent: sum((top) => top.spent),
    },
  ];
}

export const lineMoney = (line: Line, amount: number) => {
  const text = display.text([{ ...line.cur, amount }]);
  return line.approx ? `≈${text}` : text;
};

export const topMoney = (top: Top, amount: number) =>
  `${top.approx ? "≈" : ""}${formatMoney({ amount, decimals: 0, symbol: top.cur.symbol })}`;

export function pace(line: Line, now = today()): Pace | null {
  if (!(line.amount && contains(line.range, now))) {
    return null;
  }
  const total = daysBetween(line.range.start, line.range.end) + 1;
  const elapsed = daysBetween(line.range.start, now) + 1;
  const expected = (line.amount * elapsed) / total;
  return { expected, fraction: elapsed / total, over: -line.spent - expected };
}

export function projection(line: Line, now = today()): number | null {
  if (!contains(line.range, now)) {
    return null;
  }
  const total = daysBetween(line.range.start, line.range.end) + 1;
  const elapsed = daysBetween(line.range.start, now) + 1;
  return (-line.spent * total) / elapsed;
}

export function safePerDay(line: Line, now = today()): number | null {
  if (line.amount === null || !contains(line.range, now)) {
    return null;
  }
  const left = daysBetween(now, line.range.end) + 1;
  return Math.max(0, line.amount + line.spent) / left;
}

const AVERAGE_OF = 3;

export function niceCeil(value: number) {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.ceil(value / step) * step;
}

export async function averages(
  range: Range,
  view: ViewRange
): Promise<Map<string, number>> {
  const fixed = isDynamic(view) ? "1M" : view;
  const ranges: Range[] = [];
  let step = range;
  for (let i = 0; i < AVERAGE_OF; i += 1) {
    step = shiftPeriod(step, fixed, -1);
    ranges.push(step);
  }
  const periods = await Promise.all(
    ranges.map((item) =>
      all<Budget>("/v1/budgets", { end: item.end, start: item.start })
    )
  );
  const sums = new Map<string, number>();
  for (const budget of periods.flat()) {
    for (const sum of fromEntries(budget.attributes.spent)) {
      const key = `${budget.id}:${sum.code}`;
      sums.set(key, (sums.get(key) ?? 0) - sum.amount / AVERAGE_OF);
    }
  }
  const out = new Map<string, number>();
  for (const [key, value] of sums) {
    if (value > 0) {
      out.set(key, niceCeil(value));
    }
  }
  return out;
}

const SPACES = /\s/g;

export const parseAmount = (raw: string): number | null => {
  const clean = raw.replace(SPACES, "").replace(",", ".");
  if (clean === "") {
    return 0;
  }
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export async function saveLimit(
  budgetId: string,
  line: Line,
  amount: number,
  range: Range
) {
  const { limit } = line;
  if (limit && amount === 0) {
    await api(`/v1/budgets/${budgetId}/limits/${limit.id}`, {
      method: "DELETE",
    });
    return;
  }
  if (limit) {
    await api(`/v1/budgets/${budgetId}/limits/${limit.id}`, {
      body: { amount: String(amount) },
      method: "PUT",
    });
    return;
  }
  if (amount === 0) {
    return;
  }
  await api(`/v1/budgets/${budgetId}/limits`, {
    body: {
      amount: String(amount),
      currency_code: line.cur.code,
      end: range.end,
      start: range.start,
    },
    method: "POST",
  });
}
