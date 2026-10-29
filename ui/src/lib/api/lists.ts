import { QueryClient } from "@tanstack/svelte-query";
import { api, type Query } from "./client.js";
import type {
  Account,
  Bill,
  Budget,
  Category,
  Item,
  ObjectGroup,
  Page,
  PiggyBank,
  Tag,
} from "./types.js";

const STALE_MS = 60_000;
const ALL_LIMIT = 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: STALE_MS,
    },
  },
});

export async function all<T>(
  path: string,
  query: Query = {}
): Promise<Item<T>[]> {
  const first = await api<Page<T>>(path, {
    query: { ...query, limit: ALL_LIMIT, page: 1 },
  });
  const pages = first.meta.pagination?.total_pages ?? 1;
  if (pages <= 1) {
    return first.data;
  }
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      api<Page<T>>(path, { query: { ...query, limit: ALL_LIMIT, page: i + 2 } })
    )
  );
  return [...first.data, ...rest.flatMap((page) => page.data)];
}

export const lists = {
  accounts: (type = "all") => ({
    queryFn: () => all<Account>("/v1/accounts", { type }),
    queryKey: ["accounts", type],
  }),
  bills: () => ({
    queryFn: () => all<Bill>("/v1/bills"),
    queryKey: ["bills"],
  }),
  budgets: () => ({
    queryFn: () => all<Budget>("/v1/budgets"),
    queryKey: ["budgets"],
  }),
  categories: () => ({
    queryFn: () => all<Category>("/v1/categories"),
    queryKey: ["categories"],
  }),
  objectGroups: () => ({
    queryFn: () => all<ObjectGroup>("/v1/object-groups"),
    queryKey: ["object-groups"],
  }),
  piggyBanks: () => ({
    queryFn: () => all<PiggyBank>("/v1/piggy-banks"),
    queryKey: ["piggy-banks"],
  }),
  tags: () => ({
    queryFn: () => all<Tag>("/v1/tags"),
    queryKey: ["tags"],
  }),
};

export function invalidate() {
  return queryClient.invalidateQueries();
}
