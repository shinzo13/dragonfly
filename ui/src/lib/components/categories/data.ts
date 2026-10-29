import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type {
  Category,
  Currency,
  InsightTotalEntry,
  Item,
  Page,
  TransactionGroup,
} from "#lib/api/types.js";
import type { Range } from "#lib/dates.js";
import { toNumber } from "#lib/format.js";
import { add, fromEntries, list, type Sum, type Sums } from "./sums.js";

export interface CategoryRow {
  earned: Sum[];
  item: Item<Category>;
  spent: Sum[];
}

export interface CategoryPage {
  earned: Sum[];
  rows: CategoryRow[];
  spent: Sum[];
}

function insightSums(
  entries: InsightTotalEntry[],
  currencies: Item<Currency>[]
): Sum[] {
  const sums: Sums = {};
  for (const entry of entries) {
    const cur = currencies.find(
      (c) => c.attributes.code === entry.currency_code
    )?.attributes;
    add(
      sums,
      {
        code: entry.currency_code ?? "",
        decimals: cur?.decimal_places ?? 2,
        symbol: cur?.symbol ?? entry.currency_code ?? "",
      },
      toNumber(entry.difference)
    );
  }
  return list(sums);
}

export async function loadCategoryPage(
  range: Range,
  currencies: Item<Currency>[]
): Promise<CategoryPage> {
  const query = { end: range.end, start: range.start };
  const [items, spent, earned] = await Promise.all([
    all<Category>("/v1/categories", query),
    api<InsightTotalEntry[]>("/v1/insight/expense/no-category", { query }),
    api<InsightTotalEntry[]>("/v1/insight/income/no-category", { query }),
  ]);
  return {
    earned: insightSums(earned, currencies),
    rows: items.map((item) => ({
      earned: fromEntries(item.attributes.earned),
      item,
      spent: fromEntries(item.attributes.spent),
    })),
    spent: insightSums(spent, currencies),
  };
}

const SEARCH_LIMIT = 500;

export async function searchAll(query: string) {
  const first = await api<Page<TransactionGroup>>("/v1/search/transactions", {
    query: { limit: SEARCH_LIMIT, page: 1, query },
  });
  const pages = first.meta.pagination?.total_pages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      api<Page<TransactionGroup>>("/v1/search/transactions", {
        query: { limit: SEARCH_LIMIT, page: i + 2, query },
      })
    )
  );
  const seen = new Map<string, Item<TransactionGroup>>();
  for (const group of [first, ...rest].flatMap((page) => page.data)) {
    seen.set(group.id, group);
  }
  return [...seen.values()];
}
