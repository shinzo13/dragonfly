import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type { Bill, Item, Page, TransactionGroup } from "#lib/api/types.js";
import { addDays } from "#lib/dates.js";
import { toPayments } from "./runway.js";

const SEARCH_LIMIT = 500;
const UNLINKED_DAYS = 92;

async function search(query: string): Promise<Item<TransactionGroup>[]> {
  const read = (page: number) =>
    api<Page<TransactionGroup>>("/v1/search/transactions", {
      query: { limit: SEARCH_LIMIT, page, query },
    });
  const first = await read(1);
  const pages = first.meta.pagination?.total_pages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => read(i + 2))
  );
  const seen = new Map<string, Item<TransactionGroup>>();
  for (const group of [first, ...rest].flatMap((page) => page.data)) {
    seen.set(group.id, group);
  }
  return [...seen.values()];
}

export const runwayQueries = {
  bills: (start: string, end: string) => ({
    queryFn: () => all<Bill>("/v1/bills", { end, start }),
    queryKey: ["subscriptions", "runway", start, end],
    refetchOnWindowFocus: true,
  }),
  paid: () => ({
    queryFn: async () => toPayments(await search("has_any_bill:true")),
    queryKey: ["subscriptions", "payments"],
    refetchOnWindowFocus: true,
  }),
  unlinked: (day: string) => {
    const after = addDays(day, -UNLINKED_DAYS);
    return {
      queryFn: async () =>
        toPayments(
          await search(`has_no_bill:true type:withdrawal date_after:${after}`)
        ).filter((payment) => !payment.billId),
      queryKey: ["subscriptions", "unlinked", after],
    };
  },
};
