import type { Item, Split, Tag } from "#lib/api/types.js";
import { buildTree, flatten } from "#lib/components/tags/tree.js";
import { type Flow, type Key, keys, NONE } from "#lib/reports/flows.js";

export interface Facet {
  id: string;
  incomeLabel?: string;
  label: string;
  of: (flow: Flow) => Key[];
}

export interface Spec {
  facets: Facet[];
  keep: (split: Split) => boolean;
  source: string;
}

const listOf = (pick: (flow: Flow) => Key | null) => (flow: Flow) => {
  const key = pick(flow);
  return key ? [key] : [];
};

const facets = {
  budgets: { id: "budgets", label: "Budgets", of: listOf(keys.budget) },
  cards: { id: "cards", label: "Cards", of: listOf(keys.asset) },
  categories: {
    id: "categories",
    label: "Categories",
    of: listOf(keys.category),
  },
  merchants: {
    id: "merchants",
    incomeLabel: "Payers",
    label: "Merchants",
    of: listOf(keys.other),
  },
  tags: { id: "tags", label: "Tags", of: keys.tag },
} satisfies Record<string, Facet>;

export const categorySpec = (id: string): Spec => ({
  facets: [facets.merchants, facets.cards, facets.budgets, facets.tags],
  keep: (split) => String(split.category_id ?? "") === id,
  source: `/v1/categories/${id}/transactions`,
});

export const budgetSpec = (id: string): Spec => ({
  facets: [facets.merchants, facets.cards, facets.categories, facets.tags],
  keep: (split) => String(split.budget_id ?? "") === id,
  source: `/v1/budgets/${id}/transactions`,
});

export const merchantSpec = (id: string): Spec => ({
  facets: [facets.categories, facets.cards, facets.budgets, facets.tags],
  keep: (split) =>
    String(split.source_id) === id || String(split.destination_id) === id,
  source: `/v1/accounts/${id}/transactions`,
});

export const underTag = (name: string, tag: string) =>
  tag === name || tag.startsWith(`${name}/`);

function subtagFacet(name: string, tags: Item<Tag>[]): Facet | null {
  const node = flatten(buildTree(tags)).find((n) => n.path === name);
  const children = node?.children ?? [];
  if (children.length === 0) {
    return null;
  }
  const childOf = (tag: string): Key | null => {
    if (tag === name) {
      return { key: NONE, label: "(no subtag)" };
    }
    const child = children.find((c) => underTag(c.path, tag));
    return child
      ? {
          href: `/tags/show/${encodeURIComponent(child.path)}`,
          key: child.path,
          label: child.name,
        }
      : null;
  };
  return {
    id: "subtags",
    label: "Subtags",
    of: (flow) => {
      const found = new Map<string, Key>();
      for (const tag of flow.tags) {
        const key = childOf(tag);
        if (key) {
          found.set(key.key, key);
        }
      }
      return [...found.values()];
    },
  };
}

export function tagSpec(name: string, tags: Item<Tag>[]): Spec {
  const subtags = subtagFacet(name, tags);
  return {
    facets: [
      ...(subtags ? [subtags] : []),
      facets.merchants,
      facets.cards,
      facets.categories,
    ],
    keep: (split) => (split.tags ?? []).some((tag) => underTag(name, tag)),
    source: "/v1/transactions",
  };
}
