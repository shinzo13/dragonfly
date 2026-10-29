import type { Account, Bill, Item, TransactionGroup } from "#lib/api/types.js";
import {
  average,
  cycleDays,
  isRange,
  twoCyclesAfter,
} from "#lib/components/subscriptions/bills.js";
import { addDays, addMonths, daysBetween } from "#lib/dates.js";
import { toNumber } from "#lib/format.js";

const EARLY_SHARE = 3;
const CENT = 0.005;

export interface Currency {
  code: string;
  decimals: number;
  symbol: string;
}

export interface Sum extends Currency {
  amount: number;
}

export interface Payment extends Currency {
  amount: number;
  billId: string;
  date: string;
  description: string;
  destinationId: string;
  foreign: number;
  foreignCode: string;
  groupId: string;
  journalId: string;
  sourceId: string;
  sourceName: string;
}

export interface Card extends Currency {
  balance: number | null;
  id: string;
  name: string;
}

export interface Payer {
  card: Card | null;
  last: Payment | undefined;
  manual: boolean;
}

export interface Due {
  approx: boolean;
  bill: Item<Bill>;
  card: Card | null;
  date: string;
  lastPaid: string;
  manual: boolean;
  native: Sum;
  overdue: boolean;
  pay: Sum;
}

export interface Need {
  balance: number | null;
  currency: Currency | null;
  dues: Due[];
  id: string;
  name: string;
  short: { amount: number; date: string } | null;
  totals: Sum[];
}

export const HORIZONS = [
  { id: "7", key: "1", label: "7 days" },
  { id: "14", key: "2", label: "14 days" },
  { id: "month", key: "3", label: "Rest of month" },
  { id: "30", key: "4", label: "30 days" },
] as const;
export type Horizon = (typeof HORIZONS)[number]["id"];

export const UNKNOWN = "unknown";
export const STRIP_DAYS = 30;
export const RENEWAL_DAYS = 60;

export function horizonEnd(horizon: Horizon, day: string): string {
  if (horizon === "month") {
    return addDays(addMonths(`${day.slice(0, 7)}-01`, 1), -1);
  }
  return addDays(day, Number(horizon));
}

export const billCurrency = (bill: Bill): Currency => ({
  code: bill.currency_code ?? "",
  decimals: bill.currency_decimal_places ?? 2,
  symbol: bill.currency_symbol ?? bill.currency_code ?? "",
});

export function toPayments(groups: Item<TransactionGroup>[]): Payment[] {
  return groups
    .flatMap((group) =>
      group.attributes.transactions.map((split) => ({
        amount: Math.abs(toNumber(split.amount)),
        billId: split.bill_id ?? "",
        code: split.currency_code ?? "",
        date: split.date.slice(0, 10),
        decimals: split.currency_decimal_places ?? 2,
        description: split.description,
        destinationId: split.destination_id ?? "",
        foreign: Math.abs(toNumber(split.foreign_amount)),
        foreignCode: split.foreign_currency_code ?? "",
        groupId: group.id,
        journalId: split.transaction_journal_id ?? "",
        sourceId: split.source_id ?? "",
        sourceName: split.source_name ?? "",
        symbol: split.currency_symbol ?? split.currency_code ?? "",
      }))
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function byBill(payments: Payment[]): Map<string, Payment[]> {
  const map = new Map<string, Payment[]>();
  for (const payment of payments) {
    map.set(payment.billId, [...(map.get(payment.billId) ?? []), payment]);
  }
  return map;
}

export const toCards = (accounts: Item<Account>[]) =>
  new Map<string, Card>(
    accounts.map(({ id, attributes: a }) => [
      id,
      {
        balance: toNumber(a.current_balance),
        code: a.currency_code ?? "",
        decimals: a.currency_decimal_places ?? 2,
        id,
        name: a.name,
        symbol: a.currency_symbol ?? a.currency_code ?? "",
      },
    ])
  );

export function payerOf(
  last: Payment | undefined,
  cards: Map<string, Card>,
  manual: string | null
): Payer {
  const chosen = manual ? cards.get(manual) : undefined;
  if (chosen) {
    return { card: chosen, last, manual: true };
  }
  if (!last) {
    return { card: null, last, manual: false };
  }
  const card = cards.get(last.sourceId) ?? {
    balance: null,
    code: last.code,
    decimals: last.decimals,
    id: last.sourceId,
    name: last.sourceName,
    symbol: last.symbol,
  };
  return { card, last, manual: false };
}

export function ownRates(payments: Payment[]): Map<string, number> {
  const rates = new Map<string, number>();
  for (const p of payments) {
    if (p.foreign > 0 && p.foreignCode && p.foreignCode !== p.code) {
      const forward = `${p.foreignCode}>${p.code}`;
      const back = `${p.code}>${p.foreignCode}`;
      rates.set(forward, rates.get(forward) ?? p.amount / p.foreign);
      rates.set(back, rates.get(back) ?? p.foreign / p.amount);
    }
  }
  return rates;
}

function rateFor(
  from: string,
  payer: Payer,
  rates: Map<string, number>
): number | null {
  const to = payer.card?.code ?? from;
  if (from === to) {
    return 1;
  }
  const { last } = payer;
  if (last && last.code === to && last.foreignCode === from && last.foreign) {
    return last.amount / last.foreign;
  }
  return rates.get(`${from}>${to}`) ?? null;
}

export function priceIn(payment: Payment, code: string): number | null {
  if (payment.code === code) {
    return payment.amount;
  }
  return payment.foreignCode === code && payment.foreign
    ? payment.foreign
    : null;
}

function occurrences(bill: Bill, day: string) {
  const paid = (bill.paid_dates ?? []).map((p) => (p.date ?? "").slice(0, 10));
  const early = cycleDays(bill) / EARLY_SHARE;
  const end = bill.end_date?.slice(0, 10);
  return (bill.pay_dates ?? [])
    .map((raw) => raw.slice(0, 10))
    .filter((date) => !end || date <= end)
    .filter((date) => !paid.some((p) => Math.abs(daysBetween(p, date)) < early))
    .map((date) => ({ date: date < day ? day : date, overdue: date < day }));
}

export function dues(
  bills: Item<Bill>[],
  day: string,
  payer: (bill: Item<Bill>) => Payer,
  rates: Map<string, number>
): Due[] {
  return bills
    .filter((bill) => bill.attributes.active)
    .flatMap((bill) => {
      const native: Sum = {
        ...billCurrency(bill.attributes),
        amount: average(bill.attributes),
      };
      const who = payer(bill);
      const rate = rateFor(native.code, who, rates);
      const pay: Sum =
        rate !== null && who.card
          ? { ...who.card, amount: native.amount * rate }
          : native;
      return occurrences(bill.attributes, day).map(({ date, overdue }) => ({
        approx: isRange(bill.attributes) || (rate !== null && rate !== 1),
        bill,
        card: who.card,
        date,
        lastPaid: who.last?.date ?? "",
        manual: who.manual,
        native,
        overdue,
        pay,
      }));
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function sum(entries: Sum[]): Sum[] {
  const totals = new Map<string, Sum>();
  for (const entry of entries) {
    const total = totals.get(entry.code) ?? { ...entry, amount: 0 };
    total.amount += entry.amount;
    totals.set(entry.code, total);
  }
  return [...totals.values()];
}

function shortfall(list: Due[], balance: number | null, code: string) {
  if (balance === null) {
    return null;
  }
  let running = 0;
  let date = "";
  for (const due of list) {
    if (due.pay.code === code) {
      running += due.pay.amount;
      if (!date && running > balance + CENT) {
        ({ date } = due);
      }
    }
  }
  return date ? { amount: running - balance, date } : null;
}

function rank(a: Need, b: Need): number {
  const order = (n: Need) => {
    if (n.short) {
      return 0;
    }
    return n.id === UNKNOWN ? 2 : 1;
  };
  return order(a) - order(b) || a.name.localeCompare(b.name);
}

function need(
  id: string,
  name: string,
  list: Due[],
  currency: Currency | null,
  balance: number | null
): Need {
  return {
    balance,
    currency,
    dues: list,
    id,
    name,
    short: currency ? shortfall(list, balance, currency.code) : null,
    totals: sum(list.map((d) => d.pay)),
  };
}

function grouped(list: Due[], key: (due: Due) => string) {
  const map = new Map<string, Due[]>();
  for (const due of list) {
    map.set(key(due), [...(map.get(key(due)) ?? []), due]);
  }
  return map;
}

export function byCard(list: Due[]): Need[] {
  return [...grouped(list, (d) => d.card?.id ?? UNKNOWN)]
    .map(([id, items]) => {
      const { card } = items[0];
      return card
        ? need(id, card.name, items, card, card.balance)
        : need(id, "Card unknown", items, null, null);
    })
    .sort(rank);
}

export function byCurrency(list: Due[]): Need[] {
  return [...grouped(list, (d) => d.pay.code)]
    .map(([code, items]) => {
      const paying = new Map<string, number>();
      for (const { card } of items) {
        if (card?.code === code && card.balance !== null) {
          paying.set(card.id, card.balance);
        }
      }
      const balance = paying.size
        ? [...paying.values()].reduce((total, b) => total + b, 0)
        : null;
      return need(code, code, items, items[0].pay, balance);
    })
    .sort(rank);
}

export interface Creep extends Currency {
  from: number;
  since: string;
  to: number;
}

export function creep(bill: Bill, history: Payment[]): Creep | null {
  if (isRange(bill)) {
    return null;
  }
  const currency = billCurrency(bill);
  const prices = history
    .map((p) => ({ amount: priceIn(p, currency.code), date: p.date }))
    .filter((p): p is { amount: number; date: string } => p.amount !== null);
  const [latest] = prices;
  const change = prices.findIndex(
    (p) => Math.abs(p.amount - (latest?.amount ?? 0)) > CENT
  );
  if (!latest || change < 1) {
    return null;
  }
  return {
    ...currency,
    from: prices[change].amount,
    since: prices[change - 1].date,
    to: latest.amount,
  };
}

export function staleSince(
  bill: Bill,
  last: Payment | undefined,
  day: string
): string | null {
  const from = last?.date ?? bill.date?.slice(0, 10);
  if (!(bill.active && from) || twoCyclesAfter(bill, from) >= day) {
    return null;
  }
  return last?.date ?? "";
}

export function matches(
  bills: Item<Bill>[],
  candidates: Payment[],
  last: (bill: Item<Bill>) => Payment | undefined,
  day: string
): Map<string, Payment[]> {
  const found = new Map<string, Payment[]>();
  const active = bills.filter((b) => b.attributes.active && last(b));
  for (const payment of candidates.filter((c) => c.date <= day)) {
    const fits = active
      .map((bill) => {
        const a = bill.attributes;
        const price = priceIn(payment, a.currency_code ?? "");
        const min = toNumber(a.amount_min);
        const max = toNumber(a.amount_max);
        const ok =
          price !== null &&
          last(bill)?.destinationId === payment.destinationId &&
          price >= min - CENT &&
          price <= max + CENT &&
          payment.date >= (a.date ?? "").slice(0, 10);
        return { bill, ok, width: max - min };
      })
      .filter((f) => f.ok)
      .sort((x, y) => x.width - y.width);
    const best = fits[0]?.bill;
    if (best) {
      found.set(best.id, [...(found.get(best.id) ?? []), payment]);
    }
  }
  return found;
}

export const isYearly = (bill: Bill) => bill.repeat_freq === "yearly";
