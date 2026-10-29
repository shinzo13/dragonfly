import { api } from "#lib/api/client.js";
import { all, queryClient } from "#lib/api/lists.js";
import type { Item, Page, Split, TransactionGroup } from "#lib/api/types.js";
import {
  add,
  curOfSplit,
  list,
  type Sum,
  type Sums,
} from "#lib/components/categories/sums.js";
import type { Range } from "#lib/dates.js";
import { toNumber } from "#lib/format.js";
import {
  type Patch,
  type Targets,
  updateGroups,
} from "#lib/transactions/mass.js";
import { journalId } from "#lib/transactions/split.js";

const IN_FLIGHT = 6;
const SEARCH_LIMIT = 500;
const SAMPLES = 3;

export type Scope = "period" | "all";

export interface Option {
  id: string;
  name: string;
}

export interface Entry {
  group: Item<TransactionGroup>;
  key: string;
  split: Split;
}

export interface Place {
  accountId: string;
  entries: Entry[];
  key: string;
  name: string;
  type: string;
}

export const withoutBudget = (range: Range | null) =>
  all<TransactionGroup>("/v1/budgets/transactions-without-budget", {
    type: "withdrawal",
    ...range,
  });

async function searchFrom(
  query: string,
  page: number
): Promise<Item<TransactionGroup>[]> {
  const result = await api<Page<TransactionGroup>>("/v1/search/transactions", {
    query: { limit: SEARCH_LIMIT, page, query },
  });
  return result.data.length < SEARCH_LIMIT
    ? result.data
    : [...result.data, ...(await searchFrom(query, page + 1))];
}

export async function withoutCategory(range: Range | null) {
  const dates = range
    ? ` date_after:${range.start} date_before:${range.end}`
    : "";
  const groups = await searchFrom(`has_no_category:true${dates}`, 1);
  return [...new Map(groups.map((group) => [group.id, group])).values()];
}

const byDate = (a: Entry, b: Entry) => b.split.date.localeCompare(a.split.date);

export function placesOf(
  groups: Item<TransactionGroup>[],
  keep: (split: Split) => boolean
): Place[] {
  const places = new Map<string, Place>();
  for (const group of groups) {
    for (const split of group.attributes.transactions.filter(keep)) {
      const deposit = split.type === "deposit";
      const accountId =
        (deposit ? split.source_id : split.destination_id) ?? "";
      const key = `${split.type}:${accountId}`;
      const place = places.get(key) ?? {
        accountId,
        entries: [],
        key,
        name: (deposit ? split.source_name : split.destination_name) ?? "",
        type: split.type,
      };
      place.entries.push({ group, key: journalId(split), split });
      places.set(key, place);
    }
  }
  return [...places.values()]
    .map((place) => ({ ...place, entries: place.entries.sort(byDate) }))
    .sort(
      (a, b) =>
        b.entries.length - a.entries.length || a.name.localeCompare(b.name)
    );
}

export function sumsOf(entries: Entry[]): Sum[] {
  const sums: Sums = {};
  for (const { split } of entries) {
    const sign = split.type === "withdrawal" ? -1 : 1;
    add(sums, curOfSplit(split), sign * toNumber(split.amount));
  }
  return list(sums);
}

export const samplesOf = (entries: Entry[]) =>
  [...new Set(entries.map((entry) => entry.split.description))].slice(
    0,
    SAMPLES
  );

export function targetsOf(entries: Entry[]): Targets {
  const targets: Targets = new Map();
  for (const { group, key } of entries) {
    const set = targets.get(group.id) ?? new Set<string>();
    set.add(key);
    targets.set(group.id, set);
  }
  return targets;
}

let running = 0;
const waiting: (() => void)[] = [];

async function slot<T>(task: () => Promise<T>): Promise<T> {
  if (running < IN_FLIGHT) {
    running += 1;
  } else {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) {
      next();
    } else {
      running -= 1;
    }
  }
}

export async function applyPatch(
  targets: Targets,
  patch: Patch,
  progress: (done: number) => void
): Promise<string[]> {
  let done = 0;
  const errors: string[] = [];
  await Promise.all(
    [...targets].map((target) =>
      slot(async () => {
        const outcome = await updateGroups(
          new Map([target]),
          () => patch,
          () => undefined
        );
        errors.push(...outcome.errors);
        done += 1;
        progress(done);
      })
    )
  );
  return errors;
}

export const refreshExcept = (key: unknown[]) => {
  const own = JSON.stringify(key);
  return queryClient.invalidateQueries({
    predicate: (query) => JSON.stringify(query.queryKey) !== own,
  });
};

export function storedSet(key: string) {
  return {
    read(): Set<string> {
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? "[]");
        return new Set(Array.isArray(value) ? value : []);
      } catch {
        return new Set();
      }
    },
    write(set: Set<string>) {
      localStorage.setItem(key, JSON.stringify([...set]));
    },
  };
}
