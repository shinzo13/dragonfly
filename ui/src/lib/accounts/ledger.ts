import type { Account, Item, TransactionGroup } from "#lib/api/types.js";
import { addMonths, daysBetween, today } from "#lib/dates.js";
import { formatMoney, toNumber } from "#lib/format.js";

export interface Movement {
  amount: number;
  counter: { id: string; name: string; type: string };
  date: string;
  description: string;
  group: string;
  into: boolean;
  opening: boolean;
}

export interface Month {
  month: string;
  received: number;
  sent: number;
}

export type Stance = "owed" | "owe" | "settled";

const OPENING = new Set(["opening balance", "liability credit"]);
const ASSET = "Asset account";
const DUST = 0.005;

export const isDebt = (item: Item<Account>) =>
  item.attributes.liability_type === "debt";

export function owed(account: Account): number {
  const debt = toNumber(account.debt_amount);
  return account.liability_direction === "debit" ? -debt : debt;
}

export function stance(account: Account): Stance {
  const position = owed(account);
  if (position > DUST) {
    return "owed";
  }
  return position < -DUST ? "owe" : "settled";
}

export const overpaid = (account: Account) =>
  toNumber(account.debt_amount) < -DUST;

export function movements(
  account: Item<Account>,
  groups: Item<TransactionGroup>[]
): Movement[] {
  const { id } = account;
  const code = account.attributes.currency_code;
  const list: Movement[] = [];
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      const into = split.destination_id === id;
      if (!(into || split.source_id === id)) {
        continue;
      }
      const foreign =
        split.currency_code !== code && split.foreign_currency_code === code;
      const side = into ? "source" : "destination";
      list.push({
        amount: Math.abs(
          toNumber(foreign ? split.foreign_amount : split.amount)
        ),
        counter: {
          id: split[`${side}_id`] ?? "",
          name: split[`${side}_name`] ?? "",
          type: split[`${side}_type`] ?? "",
        },
        date: split.date.slice(0, 10),
        description: split.description,
        group: group.id,
        into,
        opening: OPENING.has(split.type),
      });
    }
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export function averageDays(list: Movement[], credit: boolean): number | null {
  const open: { amount: number; date: string }[] = [];
  let weighted = 0;
  let total = 0;
  for (const m of list.toReversed()) {
    if (m.into === credit) {
      open.push({ amount: m.amount, date: m.date });
      continue;
    }
    let left = m.amount;
    while (left > DUST && open.length > 0) {
      const [head] = open;
      const used = Math.min(left, head.amount);
      weighted += used * daysBetween(head.date, m.date);
      total += used;
      left -= used;
      head.amount -= used;
      if (head.amount < DUST) {
        open.shift();
      }
    }
  }
  return total > 0 ? Math.round(weighted / total) : null;
}

export function months(list: Movement[], count = 12): Month[] {
  const first = addMonths(`${today().slice(0, 7)}-01`, 1 - count);
  const buckets = Array.from({ length: count }, (_, i) => ({
    month: addMonths(first, i).slice(0, 7),
    received: 0,
    sent: 0,
  }));
  const index = new Map(buckets.map((b, i) => [b.month, i]));
  for (const m of list) {
    const bucket = buckets[index.get(m.date.slice(0, 7)) ?? -1];
    if (!bucket || m.opening) {
      continue;
    }
    if (m.into) {
      bucket.sent += m.amount;
    } else {
      bucket.received += m.amount;
    }
  }
  return buckets;
}

const createUrl = (type: string, query: Record<string, string | undefined>) =>
  `/transactions/create/${type}?${new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] =>
      Boolean(entry[1])
    )
  )}`;

function counterAsset(
  list: Movement[],
  assets: Item<Account>[],
  code: string | undefined
): string | undefined {
  const usable = assets
    .filter((a) => a.attributes.active && a.attributes.currency_code === code)
    .map((a) => a.id);
  return (
    list.find((m) => usable.includes(m.counter.id))?.counter.id ?? usable[0]
  );
}

const lastSaid = (list: Movement[], into: boolean) =>
  list.find((m) => m.into === into && m.counter.type === ASSET)?.description;

const plain = (account: Account, value: number) =>
  Math.abs(value).toFixed(account.currency_decimal_places ?? 2);

const money = (account: Account, value: number) =>
  formatMoney({
    amount: Math.abs(value),
    code: account.currency_code,
    decimals: account.currency_decimal_places,
    symbol: account.currency_symbol,
  });

export interface Action {
  hint: string;
  href: string;
  label: string;
  line?: string;
}

export interface Actions {
  more: Action;
  offset: Action | null;
  repay: Action | null;
}

interface Move {
  amount?: string;
  asset?: string;
  fallback: string;
  label: string;
  toThem: boolean;
}

function moveAction(item: Item<Account>, list: Movement[], move: Move) {
  const a = item.attributes;
  const said = overpaid(a) ? undefined : lastSaid(list, move.toThem);
  return {
    hint: `${move.label}: ${a.name}`,
    href: createUrl(move.toThem ? "withdrawal" : "deposit", {
      amount: move.amount,
      description: said ?? move.fallback,
      destination: move.toThem ? item.id : move.asset,
      source: move.toThem ? move.asset : item.id,
    }),
    label: move.label,
  };
}

function repayAction(item: Item<Account>, list: Movement[], asset?: string) {
  const a = item.attributes;
  const side = stance(a);
  if (side === "settled") {
    return null;
  }
  const toThem = side === "owe";
  return moveAction(item, list, {
    amount: plain(a, owed(a)),
    asset,
    fallback: toThem ? "Paid back" : "Repayment",
    label: toThem ? "Pay back" : "Record repayment",
    toThem,
  });
}

function moreAction(item: Item<Account>, list: Movement[], asset?: string) {
  const a = item.attributes;
  const side = stance(a);
  const toThem =
    side === "settled" ? a.liability_direction !== "debit" : side === "owed";
  return moveAction(item, list, {
    asset,
    fallback: toThem ? "Lent" : "Borrowed",
    label: toThem ? "Lend more" : "Borrow more",
    toThem,
  });
}

function offsetAction(item: Item<Account>, debts: Item<Account>[]) {
  const a = item.attributes;
  const position = owed(a);
  const [other] = debts
    .filter(
      (d) =>
        d.attributes.currency_code === a.currency_code &&
        owed(d.attributes) * position < 0
    )
    .sort(
      (x, y) => Math.abs(owed(y.attributes)) - Math.abs(owed(x.attributes))
    );
  if (!other) {
    return null;
  }
  const amount = Math.min(Math.abs(position), Math.abs(owed(other.attributes)));
  const [from, to] = position > 0 ? [item, other] : [other, item];
  const label = "Offset against another debt";
  return {
    hint: `${label}: ${a.name}`,
    href: createUrl("transfer", {
      amount: plain(a, amount),
      description: `Offset ${from.attributes.name} against ${to.attributes.name}`,
      destination: to.id,
      source: from.id,
    }),
    label,
    line: `Moves ${money(a, amount)} from ${from.attributes.name} to ${to.attributes.name} so both debts shrink.`,
  };
}

export function actionsFor(
  item: Item<Account>,
  list: Movement[],
  assets: Item<Account>[],
  debts: Item<Account>[]
): Actions {
  const asset = counterAsset(list, assets, item.attributes.currency_code);
  return {
    more: moreAction(item, list, asset),
    offset: offsetAction(item, debts),
    repay: repayAction(item, list, asset),
  };
}
