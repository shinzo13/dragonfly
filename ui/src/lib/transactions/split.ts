import type { Item, Split, TransactionGroup } from "#lib/api/types.js";
import type { Money } from "#lib/format.js";

export type Group = Item<TransactionGroup>;
export type Tone = "income" | "expense" | "transfer" | "neutral";

export interface Signed extends Money {
  amount: number;
  tone: Tone;
}

export const TYPE_LABEL: Record<string, string> = {
  deposit: "Deposit",
  "liability credit": "Liability credit",
  "opening balance": "Opening balance",
  reconciliation: "Reconciliation",
  transfer: "Transfer",
  withdrawal: "Withdrawal",
};

export const LIST_TITLE: Record<string, string> = {
  all: "All transactions",
  deposit: "Revenue / income",
  transfer: "Transfers",
  withdrawal: "Expenses",
};

export function listType(param: string): string {
  return param === "transfers" ? "transfer" : param;
}

export function listPath(type: string): string {
  return `/transactions/${type === "transfer" ? "transfers" : type}`;
}

export function groupType(group: Group): string {
  return group.attributes.transactions[0]?.type ?? "withdrawal";
}

export function groupTitle(group: Group): string {
  const { group_title, transactions } = group.attributes;
  return group_title || transactions[0]?.description || `#${group.id}`;
}

export function journalId(split: Split): string {
  return split.transaction_journal_id ?? "";
}

export function createType(type: string): string {
  return ["withdrawal", "deposit", "transfer"].includes(type)
    ? type
    : "withdrawal";
}

export const showUrl = (id: string) => `/transactions/show/${id}`;
export const editUrl = (id: string) => `/transactions/edit/${id}`;
export const cloneUrl = (group: Group) =>
  `/transactions/create/${createType(groupType(group))}?clone=${group.id}`;

function signFor(split: Split, accountId?: string): 1 | -1 {
  switch (split.type as string) {
    case "withdrawal":
      return -1;
    case "transfer":
      return accountId && split.source_id === accountId ? -1 : 1;
    case "opening balance":
      return split.source_type === "Initial balance account" ? 1 : -1;
    case "reconciliation":
      return split.source_type === "Reconciliation account" ? 1 : -1;
    case "liability credit":
      return (split.source_type as string) === "Liability credit account"
        ? -1
        : 1;
    default:
      return 1;
  }
}

export function toneOf(split: Split, sign: 1 | -1): Tone {
  if (split.type === "transfer") {
    return "transfer";
  }
  return sign < 0 ? "expense" : "income";
}

export function signedAmount(split: Split, accountId?: string): Signed {
  const sign = signFor(split, accountId);
  return {
    amount: sign * Number(split.amount),
    code: split.currency_code,
    decimals: split.currency_decimal_places,
    symbol: split.currency_symbol,
    tone: toneOf(split, sign),
  };
}

export function signedForeign(split: Split, accountId?: string): Signed | null {
  if (!(split.foreign_amount && split.foreign_currency_code)) {
    return null;
  }
  const sign = signFor(split, accountId);
  return {
    amount: sign * Number(split.foreign_amount),
    code: split.foreign_currency_code,
    decimals: split.foreign_currency_decimal_places,
    symbol: split.foreign_currency_symbol,
    tone: toneOf(split, sign),
  };
}

export function sumByCurrency(splits: Split[], accountId?: string): Signed[] {
  const sums = new Map<string, Signed>();
  for (const split of splits) {
    const money = signedAmount(split, accountId);
    const key = money.code ?? "";
    const sum = sums.get(key);
    if (sum) {
      sum.amount += money.amount;
    } else {
      sums.set(key, { ...money });
    }
  }
  return [...sums.values()];
}

export function balanceAfter(split: Split, accountId?: string): Money | null {
  if (!accountId) {
    return null;
  }
  const source = split.source_id === accountId;
  const value = source
    ? split.source_balance_after
    : split.destination_balance_after;
  if (value === null || value === undefined) {
    return null;
  }
  if (!source && split.type === "transfer" && split.foreign_currency_code) {
    return {
      amount: value,
      code: split.foreign_currency_code,
      decimals: split.foreign_currency_decimal_places,
      symbol: split.foreign_currency_symbol,
    };
  }
  return {
    amount: value,
    code: split.currency_code,
    decimals: split.currency_decimal_places,
    symbol: split.currency_symbol,
  };
}

export function accountUrl(id: string | null | undefined): string | undefined {
  return id ? `/accounts/show/${id}` : undefined;
}

export function isCash(type: string | null | undefined): boolean {
  return type === "Cash account";
}

const LIABILITY_TYPES = new Set(["Debt", "Loan", "Mortgage"]);

export function debtMove(split: Split): "in" | "out" | null {
  if (
    split.type === "deposit" &&
    LIABILITY_TYPES.has(split.source_type ?? "")
  ) {
    return "in";
  }
  if (
    split.type === "withdrawal" &&
    LIABILITY_TYPES.has(split.destination_type ?? "")
  ) {
    return "out";
  }
  return null;
}
