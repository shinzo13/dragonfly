import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type {
  Bill,
  Item,
  Page,
  Split,
  TransactionGroup,
} from "#lib/api/types.js";
import { addDays, addMonths } from "#lib/dates.js";
import { toNumber } from "#lib/format.js";
import { journalId } from "#lib/transactions/split.js";

const CENT = 0.005;

export interface Suggestion {
  bill: Item<Bill>;
  journal: string;
  month: string;
  paid: string | null;
}

export const openSplits = (splits: Split[]) =>
  splits.filter(
    (split) =>
      split.type === "withdrawal" && !split.bill_id && split.destination_id
  );

function priceIn(split: Split, code: string): number | null {
  if (split.currency_code === code) {
    return Math.abs(toNumber(split.amount));
  }
  return split.foreign_currency_code === code && split.foreign_amount
    ? Math.abs(toNumber(split.foreign_amount))
    : null;
}

function fits(bill: Bill, split: Split): boolean {
  const price = priceIn(split, bill.currency_code ?? "");
  return (
    bill.active === true &&
    price !== null &&
    price >= toNumber(bill.amount_min) - CENT &&
    price <= toNumber(bill.amount_max) + CENT &&
    (bill.date ?? "").slice(0, 10) <= split.date.slice(0, 10)
  );
}

const width = (bill: Item<Bill>) =>
  toNumber(bill.attributes.amount_max) - toNumber(bill.attributes.amount_min);

async function lastDestination(billId: string): Promise<string | null> {
  const page = await api<Page<TransactionGroup>>(
    `/v1/bills/${billId}/transactions`,
    { query: { limit: 1 } }
  );
  return page.data[0]?.attributes.transactions[0]?.destination_id ?? null;
}

export async function suggest(splits: Split[]): Promise<Suggestion[]> {
  const open = openSplits(splits);
  if (!open.length) {
    return [];
  }
  const month = `${open[0].date.slice(0, 7)}-01`;
  const bills = await all<Bill>("/v1/bills", {
    end: addDays(addMonths(month, 1), -1),
    start: month,
  });
  const candidates = open.map((split) => ({
    bills: bills.filter((bill) => fits(bill.attributes, split)),
    split,
  }));
  const ids = [
    ...new Set(candidates.flatMap((c) => c.bills.map((bill) => bill.id))),
  ];
  const last = new Map(
    await Promise.all(
      ids.map(async (id) => [id, await lastDestination(id)] as const)
    )
  );
  return candidates.flatMap(({ bills: options, split }) => {
    const [bill] = options
      .filter((option) => last.get(option.id) === split.destination_id)
      .sort((a, b) => width(a) - width(b));
    if (!bill) {
      return [];
    }
    const paid = bill.attributes.paid_dates?.[0]?.date?.slice(0, 10) ?? null;
    return [{ bill, journal: journalId(split), month, paid }];
  });
}
