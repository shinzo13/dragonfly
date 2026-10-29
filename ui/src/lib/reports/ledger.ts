import type { Account, Item, TransactionGroup } from "#lib/api/types.js";
import { addDays, addMonths, today } from "#lib/dates.js";
import { buckets, type Flow, toFlows } from "./flows.js";
import { pages } from "./queries.js";

export const LEDGER_MONTHS = 13;

export interface LedgerWindow {
  end: string;
  months: string[];
  start: string;
}

export function ledgerWindow(anchor = today()): LedgerWindow {
  const month = `${anchor.slice(0, 7)}-01`;
  const start = addMonths(month, 1 - LEDGER_MONTHS);
  const end = addDays(addMonths(month, 1), -1);
  return { end, months: buckets(start, end, "month"), start };
}

export function ledgerQuery(anchor = today()) {
  const { start, end } = ledgerWindow(anchor);
  return {
    queryFn: () =>
      pages<TransactionGroup>("/v1/transactions", {
        end,
        start,
        type: "default",
      }),
    queryKey: ["ledger", start, end],
  };
}

export function ownFlows(
  groups: Item<TransactionGroup>[],
  accounts: Item<Account>[]
): Flow[] {
  const own = accounts.filter(
    (a) =>
      a.attributes.type === "asset" ||
      a.attributes.type === "liabilities" ||
      a.attributes.type === "liability"
  );
  const currency = new Map(own.map((a) => [a.id, a.attributes.currency_code]));
  return toFlows(
    groups,
    new Set(own.map((a) => a.id)),
    (id) => currency.get(id) ?? undefined
  ).filter((flow) => flow.type === "withdrawal" || flow.type === "deposit");
}
