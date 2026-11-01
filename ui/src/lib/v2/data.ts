import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type {
  Account,
  Bill,
  Budget,
  BudgetLimit,
  Item,
  PiggyBank,
  TransactionGroup,
} from "#lib/api/types.js";
import { addDays, today } from "#lib/dates.js";

export type AccountX = Account & {
  current_balance?: string;
  pc_current_balance?: string;
  currency_symbol?: string;
  current_balance_date?: string;
};

export type BudgetX = Budget & {
  pc_spent?: { sum?: string; currency_code?: string }[];
};

export type BillX = Bill & {
  pc_amount_min?: string;
  pay_dates?: string[];
  paid_dates?: { date: string; transaction_group_id: string }[];
};

export type PiggyX = PiggyBank & {
  accounts?: { account_id: string; name: string; current_amount: string }[];
};

export interface ChartSet {
  label: string;
  currency_code: string;
  entries: Record<string, string>;
  pc_entries?: Record<string, string>;
}

const upTo = (end: string) => (end < today() ? end : today());

export const q = {
  accounts: (type: string, end: string) => ({
    queryFn: () => all<AccountX>("/v1/accounts", { date: upTo(end), type }),
    queryKey: ["v2", "accounts", type, upTo(end)],
  }),
  account: (id: string, end: string) => ({
    queryFn: () =>
      api<{ data: Item<AccountX> }>(`/v1/accounts/${id}`, { query: { date: upTo(end) } }).then((r) => r.data),
    queryKey: ["v2", "account", id, upTo(end)],
  }),
  chart: (start: string, end: string, accounts?: string[]) => ({
    queryFn: () =>
      api<ChartSet[]>("/v1/chart/account/overview", {
        query: {
          "accounts[]": accounts,
          end: end > start ? end : addDays(start, 1),
          period: "1D",
          preselected: accounts ? undefined : "assets",
          start,
        },
      }),
    queryKey: ["v2", "chart", start, end, accounts?.join(",") ?? "assets"],
  }),
  transactions: (start: string, end: string) => ({
    queryFn: () => all<TransactionGroup>("/v1/transactions", { end, start, type: "all" }),
    queryKey: ["v2", "transactions", start, end],
  }),
  accountTransactions: (id: string, start?: string, end?: string) => ({
    queryFn: () => all<TransactionGroup>(`/v1/accounts/${id}/transactions`, { end, start }),
    queryKey: ["v2", "account-transactions", id, start ?? "", end ?? ""],
  }),
  group: (id: string) => ({
    queryFn: () => api<{ data: Item<TransactionGroup> }>(`/v1/transactions/${id}`).then((r) => r.data),
    queryKey: ["v2", "group", id],
  }),
  budgets: (start: string, end: string) => ({
    queryFn: () => all<BudgetX>("/v1/budgets", { end, start }),
    queryKey: ["v2", "budgets", start, end],
  }),
  limits: (start: string, end: string) => ({
    queryFn: () => all<BudgetLimit>("/v1/budget-limits", { end, start }),
    queryKey: ["v2", "limits", start, end],
  }),
  bills: (start: string, end: string) => ({
    queryFn: () => all<BillX>("/v1/bills", { end, start }),
    queryKey: ["v2", "bills", start, end],
  }),
  piggies: () => ({
    queryFn: () => all<PiggyX>("/v1/piggy-banks"),
    queryKey: ["v2", "piggies"],
  }),
};
