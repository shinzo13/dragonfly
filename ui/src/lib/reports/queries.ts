import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type {
  Account,
  Bill,
  BudgetLimit,
  ChartDataSet,
  InsightGroupEntry,
  Item,
  Page,
  TransactionGroup,
} from "#lib/api/types.js";
import { addDays } from "#lib/dates.js";

const PAGE = 500;

export async function pages<T>(
  path: string,
  query: Record<string, unknown>
): Promise<Item<T>[]> {
  const first = await api<Page<T>>(path, {
    query: { ...query, limit: PAGE, page: 1 },
  });
  const count = first.meta.pagination?.total_pages ?? 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, count - 1) }, (_, i) =>
      api<Page<T>>(path, { query: { ...query, limit: PAGE, page: i + 2 } })
    )
  );
  return [first, ...rest].flatMap((page) => page.data);
}

const balancesAt = async (date: string) => {
  const [assets, liabilities] = await Promise.all([
    all<Account>("/v1/accounts", { date, type: "asset" }),
    all<Account>("/v1/accounts", { date, type: "liabilities" }),
  ]);
  return new Map(
    [...assets, ...liabilities].map((item) => [
      item.id,
      Number(item.attributes.current_balance ?? 0),
    ])
  );
};

export const reportQueries = {
  balances: (start: string, end: string) => ({
    queryFn: async () => {
      const [before, after] = await Promise.all([
        balancesAt(addDays(start, -1)),
        balancesAt(end),
      ]);
      return { after, before };
    },
    queryKey: ["report", "balances", start, end],
  }),
  bills: (start: string, end: string) => ({
    queryFn: () => all<Bill>("/v1/bills", { end, start }),
    queryKey: ["report", "bills", start, end],
  }),
  chart: (start: string, end: string, period: string, accounts: string[]) => ({
    enabled: accounts.length > 0,
    queryFn: () =>
      api<ChartDataSet[]>("/v1/chart/account/overview", {
        query: { "accounts[]": accounts, end, period, start },
      }),
    queryKey: ["report", "chart", start, end, period, accounts.join(",")],
  }),
  first: () => ({
    queryFn: async () => {
      const probe = await api<Page<TransactionGroup>>("/v1/transactions", {
        query: {
          end: "2038-01-01",
          limit: 1,
          start: "1970-01-02",
          type: "all",
        },
      });
      const last = probe.meta.pagination?.total_pages ?? 1;
      const page = await api<Page<TransactionGroup>>("/v1/transactions", {
        query: {
          end: "2038-01-01",
          limit: 1,
          page: last,
          start: "1970-01-02",
          type: "all",
        },
      });
      return (
        page.data[0]?.attributes.transactions[0]?.date.slice(0, 10) ?? null
      );
    },
    queryKey: ["report", "first"],
    staleTime: 3_600_000,
  }),
  ledger: (account: string, start: string, end: string) => ({
    queryFn: () =>
      pages<TransactionGroup>(`/v1/accounts/${account}/transactions`, {
        end,
        start,
        types: "all",
      }),
    queryKey: ["report", "ledger", account, start, end],
  }),
  limitSpent: (
    budget: string,
    start: string,
    end: string,
    accounts: string[]
  ) => ({
    queryFn: () =>
      api<InsightGroupEntry[]>("/v1/insight/expense/budget", {
        query: { "accounts[]": accounts, "budgets[]": [budget], end, start },
      }),
    queryKey: ["report", "limit-spent", budget, start, end, accounts.join(",")],
  }),
  limits: (start: string, end: string) => ({
    queryFn: () => all<BudgetLimit>("/v1/budget-limits", { end, start }),
    queryKey: ["report", "limits", start, end],
  }),
  transactions: (start: string, end: string) => ({
    queryFn: () =>
      pages<TransactionGroup>("/v1/transactions", {
        end,
        start,
        type: "default",
      }),
    queryKey: ["report", "transactions", start, end],
  }),
};
