import type {
  Account,
  Bill,
  Category,
  Item,
  Tag,
  TransactionGroup,
} from "#lib/api/types.js";
import type { Usage } from "./actions.js";
import { squash } from "./tree.js";

export type Section = "same" | "once" | "unused" | "rest";

export interface Finding {
  account?: Item<Account>;
  bill?: Item<Bill>;
  category?: Item<Category>;
  sample?: Item<TransactionGroup>;
  section: Section;
}

export const SECTIONS: Record<Section, string> = {
  once: "Used once",
  rest: "Other tags",
  same: "Same name as a category, account or subscription",
  unused: "Not used",
};

const ORDER: Section[] = ["same", "once", "unused", "rest"];
const MIN_PREFIX = 3;

export const leafOf = (tag: string) => tag.slice(tag.lastIndexOf("/") + 1);

export const rankOf = (finding: Finding | undefined) =>
  ORDER.indexOf(finding?.section ?? "rest");

function sectionOf(finding: Omit<Finding, "section">, count?: number) {
  if (finding.account || finding.bill || finding.category) {
    return "same";
  }
  if (count === 1) {
    return "once";
  }
  return count === 0 ? "unused" : "rest";
}

function index<T>(items: Item<T>[], name: (item: T) => string) {
  return new Map(items.map((item) => [squash(name(item.attributes)), item]));
}

export function findings(
  tags: Item<Tag>[],
  lists: {
    accounts: Item<Account>[];
    bills: Item<Bill>[];
    categories: Item<Category>[];
    usage?: Usage;
  }
): Map<string, Finding> {
  const accounts = index(lists.accounts, (a) => a.name);
  const categories = index(lists.categories, (c) => c.name);
  return new Map(
    tags.map((tag) => {
      const leaf = squash(leafOf(tag.attributes.tag));
      const count = lists.usage?.counts.get(tag.id);
      const found = {
        account: accounts.get(leaf),
        bill:
          leaf.length < MIN_PREFIX
            ? undefined
            : lists.bills.find((bill) =>
                squash(bill.attributes.name ?? "").startsWith(leaf)
              ),
        category: categories.get(leaf),
        sample: count === 1 ? lists.usage?.samples.get(tag.id) : undefined,
      };
      return [tag.id, { ...found, section: sectionOf(found, count) }];
    })
  );
}
