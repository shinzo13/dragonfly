import type { Account, Budget, Category, Item, Tag } from "#lib/api/types.js";
import type { ListKind } from "./params.js";
import type { Option } from "./report.svelte.js";

const byLabel = (a: Option, b: Option) =>
  (a.group ?? "").localeCompare(b.group ?? "") ||
  a.label.localeCompare(b.label);

export function budgetOptions(budgets: Item<Budget>[] = []): Option[] {
  return budgets
    .filter((b) => b.attributes.active !== false)
    .map((b) => ({ id: b.id, label: b.attributes.name }))
    .sort(byLabel);
}

export function categoryOptions(categories: Item<Category>[] = []): Option[] {
  return categories
    .map((c) => ({ id: c.id, label: c.attributes.name }))
    .sort(byLabel);
}

export function tagOptions(tags: Item<Tag>[] = []): Option[] {
  return tags
    .map((t) => ({
      group: t.attributes.date ? t.attributes.date.slice(0, 4) : "(no date)",
      id: t.id,
      label: t.attributes.tag,
    }))
    .sort(byLabel);
}

export function doubleOptions(
  expense: Item<Account>[] = [],
  revenue: Item<Account>[] = []
): Option[] {
  const revenueNames = new Set(
    revenue.map((a) => a.attributes.name.toLowerCase())
  );
  const revenueIbans = new Set(
    revenue.map((a) => a.attributes.iban).filter(Boolean)
  );
  const paired = (a: Account) =>
    revenueNames.has(a.name.toLowerCase()) ||
    (!!a.iban && revenueIbans.has(a.iban));
  const label = (a: Account) => (a.iban ? `${a.name} (${a.iban})` : a.name);
  const pairs = expense.filter((a) => paired(a.attributes));
  const pairedNames = new Set(
    pairs.map((a) => a.attributes.name.toLowerCase())
  );
  return [
    ...pairs.map((a) => ({
      group: "Expense and revenue",
      id: a.id,
      label: label(a.attributes),
    })),
    ...expense
      .filter((a) => !paired(a.attributes))
      .map((a) => ({
        group: "Expense accounts",
        id: a.id,
        label: label(a.attributes),
      })),
    ...revenue
      .filter((a) => !pairedNames.has(a.attributes.name.toLowerCase()))
      .map((a) => ({
        group: "Revenue accounts",
        id: a.id,
        label: label(a.attributes),
      })),
  ].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      a.label.localeCompare(b.label)
  );
}

const GROUP_ORDER = [
  "Expense and revenue",
  "Expense accounts",
  "Revenue accounts",
];

export interface ListSources {
  budgets?: Item<Budget>[];
  categories?: Item<Category>[];
  expense?: Item<Account>[];
  revenue?: Item<Account>[];
  tags?: Item<Tag>[];
}

export function listOptions(kind: ListKind, sources: ListSources): Option[] {
  switch (kind) {
    case "budget":
      return budgetOptions(sources.budgets);
    case "category":
      return categoryOptions(sources.categories);
    case "tag":
      return tagOptions(sources.tags);
    default:
      return doubleOptions(sources.expense, sources.revenue);
  }
}

export function listReady(kind: ListKind, sources: ListSources): boolean {
  switch (kind) {
    case "budget":
      return !!sources.budgets;
    case "category":
      return !!sources.categories;
    case "tag":
      return !!sources.tags;
    default:
      return !!(sources.expense && sources.revenue);
  }
}
