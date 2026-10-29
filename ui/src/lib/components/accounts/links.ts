import type { Account, AccountType, Item } from "#lib/api/types.js";
import { isSpaPath, oldUiUrl } from "#lib/spa-paths.js";
import { goto } from "$app/navigation";

export const TYPE_TITLE: Record<AccountType, string> = {
  asset: "Asset accounts",
  expense: "Expense accounts",
  liabilities: "Liabilities",
  revenue: "Revenue accounts",
};

export const TYPE_ONE: Record<AccountType, string> = {
  asset: "asset account",
  expense: "expense account",
  liabilities: "liability",
  revenue: "revenue account",
};

export const ROLE_LABEL: Record<string, string> = {
  cashWalletAsset: "Cash wallet",
  ccAsset: "Credit card",
  defaultAsset: "Default asset account",
  savingAsset: "Savings account",
  sharedAsset: "Shared asset account",
};

export const LIABILITY_LABEL: Record<string, string> = {
  debt: "Debt",
  loan: "Loan",
  mortgage: "Mortgage",
};

export const DIRECTION_LABEL: Record<string, string> = {
  credit: "Owed to you",
  debit: "You owe",
};

export const PERIOD_LABEL: Record<string, string> = {
  daily: "per day",
  "half-year": "per half year",
  monthly: "per month",
  quarterly: "per quarter",
  weekly: "per week",
  yearly: "per year",
};

const ACCOUNT_TYPES = new Set<string>([
  "asset",
  "expense",
  "revenue",
  "liabilities",
]);

export function typeOf(account: Account): AccountType {
  const type = String(account.type ?? "asset");
  if (ACCOUNT_TYPES.has(type)) {
    return type as AccountType;
  }
  return ["loan", "debt", "mortgage", "liability"].includes(type)
    ? "liabilities"
    : "asset";
}

export const showUrl = (id: string) => `/accounts/show/${id}`;
export const editUrl = (id: string) => `/accounts/edit/${id}`;
export const reconcileUrl = (id: string) => `/accounts/reconcile/${id}/index`;
export const indexUrl = (type: AccountType) => `/accounts/${type}`;

export function createUrl(
  type: "withdrawal" | "deposit" | "transfer",
  id: string
): string {
  const side = type === "deposit" ? "destination" : "source";
  return `/transactions/create/${type}?${side}=${id}`;
}

export function go(href: string) {
  if (isSpaPath(href.split("?")[0])) {
    goto(href);
  } else {
    location.assign(href);
  }
}

export function openOld(href: string) {
  location.assign(oldUiUrl(new URL(href, location.origin).href));
}

export function formatIban(account: Account): string {
  if (account.iban) {
    return account.iban
      .replace(/\s+/g, "")
      .replace(/(.{4})/g, "$1 ")
      .trim();
  }
  return account.account_number ?? "";
}

export const canReconcile = (item: Item<Account>) =>
  typeOf(item.attributes) === "asset";
