import { ApiError } from "#lib/api/client.js";

const NOT_FOUND = 404;

export const TRIGGERS: Record<string, string> = {
  ANY: "After any event",
  DESTROY_BUDGET: "After budget delete",
  DESTROY_TRANSACTION: "After transaction delete",
  STORE_BUDGET: "After budget creation",
  STORE_TRANSACTION: "After transaction creation",
  STORE_UPDATE_BUDGET_LIMIT: "After budgeted amount change",
  UPDATE_BUDGET: "After budget update",
  UPDATE_TRANSACTION: "After transaction update",
};

export const RESPONSES: Record<string, string> = {
  ACCOUNTS: "Account details",
  BUDGET: "Budget details",
  NONE: "No details",
  RELEVANT: "Relevant details",
  TRANSACTIONS: "Transaction details",
};

export const DELIVERIES: Record<string, string> = { JSON: "JSON" };

export const labels = (
  values: string[] | undefined,
  map: Record<string, string>
) => (values ?? []).map((value) => map[value] ?? value).join(", ");

export const switchedOff = (error: unknown) =>
  error instanceof ApiError && error.status === NOT_FOUND;
