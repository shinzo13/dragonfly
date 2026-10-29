import { defineParams } from "@sveltejs/kit/params";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d+$/;
const ACCOUNT_TYPES = new Set(["asset", "expense", "revenue", "liabilities"]);
const TRANSACTION_TYPES = new Set([
  "withdrawal",
  "deposit",
  "transfers",
  "transfer",
  "all",
]);

export const params = defineParams({
  accounttype: (value) => (ACCOUNT_TYPES.has(value) ? value : undefined),
  date: (value) => (ISO_DATE.test(value) ? value : undefined),
  id: (value) => (ID.test(value) ? value : undefined),
  txtype: (value) => (TRANSACTION_TYPES.has(value) ? value : undefined),
});
