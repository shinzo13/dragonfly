import { api } from "#lib/api/client.js";
import type { Account, Item, One, PiggyBank } from "#lib/api/types.js";
import type { Money } from "#lib/format.js";
import { toNumber } from "#lib/format.js";

export type Mode = "add" | "remove";

export interface Room {
  account: Item<Account> | undefined;
  balance: number;
  earmarked: number;
  free: number;
}

export function rooms(
  piggies: Item<PiggyBank>[],
  accounts: Item<Account>[]
): Map<string, Room> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const result = new Map<string, Room>();
  for (const piggy of piggies) {
    for (const link of piggy.attributes.accounts ?? []) {
      const id = link.account_id ?? "";
      const account = byId.get(id);
      const room = result.get(id) ?? {
        account,
        balance: toNumber(account?.attributes.current_balance),
        earmarked: 0,
        free: 0,
      };
      room.earmarked += toNumber(link.current_amount);
      room.free = room.balance - room.earmarked;
      result.set(id, room);
    }
  }
  return result;
}

export function limit(
  piggy: PiggyBank,
  accountId: string,
  mode: Mode,
  room: Room | undefined
): number {
  const link = piggy.accounts?.find((a) => a.account_id === accountId);
  if (mode === "remove") {
    return toNumber(link?.current_amount);
  }
  const free = Math.max(0, room?.free ?? 0);
  const target = toNumber(piggy.target_amount);
  return target > 0 ? Math.min(free, toNumber(piggy.left_to_save)) : free;
}

export const piggyMoney = (piggy: PiggyBank, amount: unknown): Money => ({
  amount: amount as string,
  code: piggy.currency_code,
  decimals: piggy.currency_decimal_places,
  symbol: piggy.currency_symbol,
});

export async function changeMoney(
  piggy: Item<PiggyBank>,
  deltas: Record<string, number>
): Promise<Item<PiggyBank>> {
  const decimals = piggy.attributes.currency_decimal_places ?? 2;
  const accounts = (piggy.attributes.accounts ?? []).map((link) => ({
    account_id: link.account_id,
    current_amount: (
      toNumber(link.current_amount) + (deltas[link.account_id ?? ""] ?? 0)
    ).toFixed(decimals),
  }));
  const saved = await api<One<PiggyBank>>(`/v1/piggy-banks/${piggy.id}`, {
    body: { accounts },
    method: "PUT",
  });
  const after = new Map(
    (saved.data.attributes.accounts ?? []).map((a) => [
      a.account_id,
      toNumber(a.current_amount),
    ])
  );
  const refused = accounts.find(
    (a) =>
      !after.has(a.account_id) ||
      Math.abs((after.get(a.account_id) ?? 0) - toNumber(a.current_amount)) >
        10 ** -decimals / 2
  );
  if (refused) {
    throw new Error(
      "Firefly kept the old amount: there is not enough money on the account"
    );
  }
  return saved.data;
}
