import { api } from "#lib/api/client.js";
import type { Item, Page, Split, TransactionGroup } from "#lib/api/types.js";
import { addMonths, daysBetween } from "#lib/dates.js";
import { isCash } from "#lib/transactions/split.js";

const COUNT = 12;
const FETCH = 25;
const MIN_COUNT = 3;
const LOOKBACK_MONTHS = 60;
const PERCENT = 100;
const ABOUT = 5;
const NOTABLE = 15;

type Side = "source" | "destination";

export interface Place {
  from: string | null;
  id: string;
  name: string;
  side: Side;
  type: string;
}

export interface Visit {
  amount: number;
  date: string;
  description: string;
  group: string;
}

export interface Usual {
  change: number;
  every: number | null;
  median: number;
}

const COUNTER: Record<string, Side> = {
  deposit: "source",
  transfer: "destination",
  withdrawal: "destination",
};

const CADENCE: [number, number, string][] = [
  [0, 1.5, "daily"],
  [5, 9, "weekly"],
  [12, 17, "every two weeks"],
  [26, 35, "monthly"],
  [80, 100, "quarterly"],
  [170, 195, "every half year"],
  [345, 385, "yearly"],
];

export function placeOf(splits: Split[]): Place | null {
  const [first] = splits;
  const side = first ? COUNTER[first.type] : undefined;
  const id = side ? first[`${side}_id`] : null;
  if (!(side && id) || isCash(first[`${side}_type`])) {
    return null;
  }
  return {
    from: first.type === "transfer" ? first.source_id : null,
    id,
    name: first[`${side}_name`] ?? "",
    side,
    type: first.type,
  };
}

function priceIn(split: Split, code: string): number | null {
  if (split.currency_code === code) {
    return Math.abs(Number(split.amount));
  }
  return split.foreign_currency_code === code && split.foreign_amount
    ? Math.abs(Number(split.foreign_amount))
    : null;
}

export function visitOf(
  group: Item<TransactionGroup>,
  place: Place,
  code: string
): Visit | null {
  const splits = group.attributes.transactions.filter(
    (split) =>
      split[`${place.side}_id`] === place.id &&
      (!place.from || split.source_id === place.from)
  );
  const prices = splits.map((split) => priceIn(split, code));
  if (!splits.length || prices.includes(null)) {
    return null;
  }
  return {
    amount: prices.reduce<number>((sum, price) => sum + (price ?? 0), 0),
    date: splits[0].date.slice(0, 10),
    description:
      group.attributes.group_title || splits[0].description || `#${group.id}`,
    group: group.id,
  };
}

export async function loadPlace(
  place: Place,
  groupId: string,
  end: string
): Promise<Item<TransactionGroup>[]> {
  const page = place.from
    ? await api<Page<TransactionGroup>>("/v1/search/transactions", {
        query: {
          limit: FETCH,
          query: `type:transfer source_account_id:${place.from} destination_account_id:${place.id} date_before:${end}`,
        },
      })
    : await api<Page<TransactionGroup>>(
        `/v1/accounts/${place.id}/transactions`,
        {
          query: {
            end,
            limit: FETCH,
            start: addMonths(end, -LOOKBACK_MONTHS),
            type: place.type,
          },
        }
      );
  return page.data.filter((group) => group.id !== groupId);
}

export const visitsIn = (
  groups: Item<TransactionGroup>[],
  place: Place,
  code: string
) =>
  groups
    .map((group) => visitOf(group, place, code))
    .filter((visit): visit is Visit => visit !== null)
    .slice(0, COUNT);

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function usualOf(current: Visit, past: Visit[]): Usual | null {
  if (past.length < MIN_COUNT) {
    return null;
  }
  const typical = median(past.map((visit) => visit.amount));
  const dates = [current, ...past].map((visit) => visit.date).sort();
  const gaps = dates.slice(1).map((date, i) => daysBetween(dates[i], date));
  return {
    change: typical ? Math.round((current.amount / typical - 1) * PERCENT) : 0,
    every: gaps.length ? median(gaps) : null,
    median: typical,
  };
}

export function cadence(days: number): string {
  return (
    CADENCE.find(([low, high]) => days >= low && days <= high)?.[2] ??
    `every ${Math.round(days)} days`
  );
}

export function verdict(change: number) {
  if (Math.abs(change) < ABOUT) {
    return { text: "about usual", warn: false };
  }
  return change > 0
    ? { text: `${change}% above usual`, warn: change >= NOTABLE }
    : { text: `${-change}% below usual`, warn: false };
}
