import { queryClient } from "#lib/api/lists.js";
import type { Item } from "#lib/api/types.js";
import type { Money } from "#lib/format.js";
import { toNumber } from "#lib/format.js";

interface Groupable {
  object_group_id?: string | null;
  object_group_order?: number | null;
  object_group_title?: string | null;
  order?: number;
}

export interface Section<T> {
  id: string;
  items: T[];
  order: number;
  title: string;
}

export const UNGROUPED = "(ungrouped)";

export function byObjectGroup<T extends Groupable>(
  items: Item<T>[]
): Section<Item<T>>[] {
  const sections = new Map<string, Section<Item<T>>>();
  for (const item of items) {
    const { object_group_id, object_group_order, object_group_title } =
      item.attributes;
    const id = object_group_id ?? "";
    let section = sections.get(id);
    if (!section) {
      section = {
        id,
        items: [],
        order: id ? (object_group_order ?? 0) : -1,
        title: object_group_title ?? UNGROUPED,
      };
      sections.set(id, section);
    }
    section.items.push(item);
  }
  const list = [...sections.values()].sort((a, b) => a.order - b.order);
  for (const section of list) {
    section.items.sort(
      (a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0)
    );
  }
  return list;
}

export interface Total {
  amount: number;
  code: string;
  decimals: number;
  symbol: string;
}

export function sumByCurrency(entries: Money[]): Total[] {
  const totals = new Map<string, Total>();
  for (const entry of entries) {
    const code = entry.code ?? "";
    const total = totals.get(code) ?? {
      amount: 0,
      code,
      decimals: entry.decimals ?? 2,
      symbol: entry.symbol ?? code,
    };
    total.amount += toNumber(entry.amount);
    totals.set(code, total);
  }
  return [...totals.values()];
}

export const LINK = "text-brand hover:underline dark:text-(--ff-series-1)";

export function swapOrder<T extends { order?: number }>(
  key: readonly unknown[],
  a: Item<T>,
  b: Item<T>
): number | undefined {
  const { order: first } = a.attributes;
  const { order: second } = b.attributes;
  queryClient.setQueryData<Item<T>[]>(key, (old) =>
    old?.map((item) => {
      if (item.id === a.id) {
        return { ...item, attributes: { ...item.attributes, order: second } };
      }
      if (item.id === b.id) {
        return { ...item, attributes: { ...item.attributes, order: first } };
      }
      return item;
    })
  );
  return second;
}
