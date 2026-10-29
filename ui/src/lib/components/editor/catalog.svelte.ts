import { createQuery } from "@tanstack/svelte-query";
import { api } from "#lib/api/client.js";
import { lists } from "#lib/api/lists.js";
import type {
  Account,
  Item,
  One,
  Page,
  TransactionGroup,
} from "#lib/api/types.js";
import { learnedBudgets, learnedCategories } from "#lib/budgets/map.js";
import type { Option } from "#lib/components/inputs/AutocompleteInput.svelte";
import { formatMoney } from "#lib/format.js";
import { fuzzyFilter } from "#lib/fuzzy.js";
import { session } from "#lib/session.svelte.js";
import { accountKind, type Cur, type Side, type TxType } from "./model.js";

const LIMIT = 40;
const OWN_KINDS = new Set(["Asset account", "Debt", "Loan", "Mortgage"]);

const lower = (value: string) => value.trim().toLowerCase();

function rank<T>(
  items: T[],
  query: string,
  text: (item: T) => string,
  recent: (item: T) => string
) {
  if (query.trim()) {
    return fuzzyFilter(items, query, text, LIMIT);
  }
  return [...items]
    .sort((a, b) => recent(b).localeCompare(recent(a)))
    .slice(0, LIMIT);
}

export interface Recent {
  split: TransactionGroup["transactions"][number];
}

export class Catalog {
  accounts = createQuery(() => lists.accounts("all"));
  categories = createQuery(() => lists.categories());
  budgets = createQuery(() => lists.budgets());
  tags = createQuery(() => lists.tags());
  bills = createQuery(() => lists.bills());
  piggies = createQuery(() => lists.piggyBanks());

  private readonly history = new Map<string, Promise<Recent | null>>();

  accountsOf(kinds: string[]): Item<Account>[] {
    return (this.accounts.data ?? []).filter(
      (item) =>
        item.attributes.active && kinds.includes(accountKind(item.attributes))
    );
  }

  findAccount(kinds: string[], name: string): Item<Account> | undefined {
    const wanted = lower(name);
    return this.accountsOf(kinds).find(
      (item) => lower(item.attributes.name) === wanted
    );
  }

  accountById(id: string): Item<Account> | undefined {
    return (this.accounts.data ?? []).find((item) => item.id === id);
  }

  billById(id: string | null | undefined) {
    return (this.bills.data ?? []).find(
      (item) => item.id === id && item.attributes.active
    );
  }

  accountOptions(kinds: string[], query: string): Option[] {
    const items = rank(
      this.accountsOf(kinds),
      query,
      (item) => item.attributes.name,
      (item) => item.attributes.last_activity ?? ""
    );
    return items.map((item) => {
      const kind = accountKind(item.attributes);
      const own = OWN_KINDS.has(kind);
      return {
        data: item,
        hint: own
          ? formatMoney({
              amount: item.attributes.current_balance,
              decimals: item.attributes.currency_decimal_places,
              symbol: item.attributes.currency_symbol,
            })
          : undefined,
        id: item.id,
        label: item.attributes.name,
        meta: own
          ? `${kind.replace(" account", "")} · ${item.attributes.currency_code}`
          : kind.replace(" account", ""),
      };
    });
  }

  categoryNames(): string[] {
    return (this.categories.data ?? []).map((item) => item.attributes.name);
  }

  categoryOptions = (query: string): Option[] =>
    rank(
      this.categories.data ?? [],
      query,
      (item) => item.attributes.name,
      (item) => item.attributes.last_activity ?? ""
    ).map((item) => ({ id: item.id, label: item.attributes.name }));

  budgetOptions = (query: string): Option[] =>
    fuzzyFilter(
      (this.budgets.data ?? []).filter((item) => item.attributes.active),
      query,
      (item) => item.attributes.name,
      LIMIT
    ).map((item) => ({ id: item.id, label: item.attributes.name }));

  billOptions = (query: string): Option[] =>
    fuzzyFilter(
      (this.bills.data ?? []).filter((item) => item.attributes.active),
      query,
      (item) => item.attributes.name ?? "",
      LIMIT
    ).map((item) => ({
      id: item.id,
      label: item.attributes.name ?? "",
      meta: item.attributes.object_group_title ?? undefined,
    }));

  piggyOptions = (query: string): Option[] =>
    fuzzyFilter(
      (this.piggies.data ?? []).filter(
        (item) => item.attributes.active !== false
      ),
      query,
      (item) => item.attributes.name,
      LIMIT
    ).map((item) => ({
      id: item.id,
      label: item.attributes.name,
      meta: item.attributes.object_group_title ?? undefined,
    }));

  tagOptions(query: string, taken: string[] = []): Option[] {
    const skip = new Set(taken.map(lower));
    return fuzzyFilter(
      (this.tags.data ?? []).filter(
        (item) => !skip.has(lower(item.attributes.tag))
      ),
      query,
      (item) => item.attributes.tag,
      LIMIT
    ).map((item) => ({ id: item.id, label: item.attributes.tag }));
  }

  findBudget(name: string) {
    const wanted = lower(name);
    return (this.budgets.data ?? []).find(
      (item) => lower(item.attributes.name) === wanted
    );
  }

  findCategory(name: string) {
    const wanted = lower(name);
    return (this.categories.data ?? []).find(
      (item) => lower(item.attributes.name) === wanted
    );
  }

  currencyOptions = (query: string): Option[] =>
    fuzzyFilter(
      session.currencies.filter((item) => item.attributes.enabled),
      query,
      (item) => `${item.attributes.code} ${item.attributes.name}`,
      LIMIT
    ).map((item) => ({
      data: {
        code: item.attributes.code,
        decimals: item.attributes.decimal_places ?? 2,
        symbol: item.attributes.symbol,
      } satisfies Cur,
      id: item.id,
      label: item.attributes.code,
      meta: item.attributes.name,
    }));

  descriptionOptions = async (query: string): Promise<Option[]> => {
    if (!query.trim()) {
      return [];
    }
    const items = await api<
      { id: string; name: string; transaction_group_id?: string }[]
    >("/v1/autocomplete/transactions", { query: { limit: 10, query } });
    return items.map((item) => ({
      data: item.id,
      id: item.id,
      label: item.name,
    }));
  };

  defaultAccount(): Item<Account> | undefined {
    const own = this.accountsOf(["Asset account"]);
    for (const id of session.frontpageAccounts) {
      const found = own.find((item) => item.id === id);
      if (found) {
        return found;
      }
    }
    return (
      own.find((item) => item.attributes.account_role === "defaultAsset") ??
      own[0]
    );
  }

  lastFor(accountId: string, side: Side, type: TxType): Promise<Recent | null> {
    const key = `${accountId}:${side}`;
    let found = this.history.get(key);
    if (!found) {
      found = api<Page<TransactionGroup>>(
        `/v1/accounts/${accountId}/transactions`,
        {
          query: { limit: 5, types: type },
        }
      )
        .then((page) => {
          for (const group of page.data) {
            const split = group.attributes.transactions.find(
              (item) => item[`${side}_id`] === accountId
            );
            if (split) {
              return { split };
            }
          }
          return null;
        })
        .catch(() => null);
      this.history.set(key, found);
    }
    const learnedBudget = learnedBudgets.get(accountId)?.id;
    const budget =
      type === "withdrawal" && side === "destination"
        ? this.budgets.data?.find(
            (item) => item.id === learnedBudget && item.attributes.active
          )
        : undefined;
    const ownSide = type === "deposit" ? "source" : "destination";
    const learnedCategory = learnedCategories.get(`${type}:${accountId}`)?.id;
    const category =
      side === ownSide
        ? this.categories.data?.find((item) => item.id === learnedCategory)
        : undefined;
    if (!(budget || category)) {
      return found;
    }
    return found.then((past) => {
      const split = past?.split;
      if (!split) {
        return past;
      }
      return {
        split: {
          ...split,
          ...(budget && {
            budget_id: budget.id,
            budget_name: budget.attributes.name,
          }),
          ...(category && {
            category_id: category.id,
            category_name: category.attributes.name,
          }),
        },
      };
    });
  }

  async fromJournal(journalId: string): Promise<Recent | null> {
    const group = await api<One<TransactionGroup>>(
      `/v1/transaction-journals/${journalId}`
    ).catch(() => null);
    const split = group?.data.attributes.transactions.find(
      (item) => item.transaction_journal_id === journalId
    );
    return split ? { split } : null;
  }
}
