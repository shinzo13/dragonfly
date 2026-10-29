import type { Item, TransactionGroup } from "#lib/api/types.js";

export type Rate = (from: string, to: string) => number | null;

type Pairs = Map<string, Map<string, [number, number]>>;

function pairs(groups: Item<TransactionGroup>[]): Pairs {
  const sums: Pairs = new Map();
  const add = (a: string, b: string, x: number, y: number) => {
    const row = sums.get(a) ?? new Map<string, [number, number]>();
    const pair = row.get(b) ?? [0, 0];
    row.set(b, [pair[0] + x, pair[1] + y]);
    sums.set(a, row);
  };
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      const from = split.currency_code;
      const to = split.foreign_currency_code;
      const x = Math.abs(Number(split.amount));
      const y = Math.abs(Number(split.foreign_amount));
      if (from && to && from !== to && x > 0 && y > 0) {
        add(from, to, x, y);
        add(to, from, y, x);
      }
    }
  }
  return sums;
}

function walk(sums: Pairs, from: string, to: string): number | null {
  const rates = new Map([[from, 1]]);
  const queue = [from];
  for (const code of queue) {
    const rate = rates.get(code) ?? 1;
    for (const [other, [x, y]] of sums.get(code) ?? []) {
      if (!rates.has(other)) {
        rates.set(other, (rate * y) / x);
        queue.push(other);
      }
    }
  }
  return rates.get(to) ?? null;
}

export function impliedRates(groups: Item<TransactionGroup>[]): Rate {
  const sums = pairs(groups);
  return (from, to) => walk(sums, from, to);
}
