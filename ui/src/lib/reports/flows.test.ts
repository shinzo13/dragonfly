/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Item, Split, TransactionGroup } from "#lib/api/types.js";
import {
  amountOf,
  bucketRange,
  buckets,
  exchanges,
  group,
  keys,
  matches,
  rank,
  toFlows,
  topFlows,
  total,
} from "./flows.js";

let nextId = 1;

function tx(split: Partial<Split>): Item<TransactionGroup> {
  nextId += 1;
  const id = String(nextId);
  return {
    attributes: {
      transactions: [
        {
          amount: "10",
          currency_code: "UAH",
          date: "2026-03-05T00:00:00+02:00",
          description: `tx ${id}`,
          destination_id: "100",
          destination_name: "Shop",
          source_id: "1",
          source_name: "Mono",
          tags: [],
          transaction_journal_id: id,
          type: "withdrawal",
          ...split,
        } as Split,
      ],
    } as TransactionGroup,
    id,
    type: "transactions",
  };
}

const currencyOf = (id: string) => ({ "1": "UAH", "2": "USD", "3": "UAH" })[id];

const groups = [
  tx({ amount: "100", category_id: "7", category_name: "Food" }),
  tx({ amount: "50", tags: ["trip", "fun"] }),
  tx({
    amount: "4000",
    destination_id: "2",
    destination_name: "Wise",
    foreign_amount: "100",
    foreign_currency_code: "USD",
    type: "transfer",
  }),
  tx({
    amount: "300",
    destination_id: "1",
    source_id: "200",
    source_name: "Employer",
    type: "deposit",
  }),
  tx({
    amount: "20",
    date: "2026-04-01T00:00:00+02:00",
    destination_id: "3",
    type: "transfer",
  }),
];

test("only flows that cross the selection count", () => {
  const flows = toFlows(groups, new Set(["1", "3"]), currencyOf);
  expect(flows.map((flow) => flow.amount)).toEqual([100, 50, 4000, 300]);
  const totals = total(flows);
  expect(amountOf(totals, "UAH", "out")).toBe(4150);
  expect(amountOf(totals, "UAH", "in")).toBe(300);
  expect(amountOf(totals, "UAH", "net")).toBe(-3850);
});

test("transfers into a selected account use the destination currency", () => {
  const flows = toFlows(groups, new Set(["2"]), currencyOf);
  expect(flows).toHaveLength(1);
  expect(flows[0]).toMatchObject({ amount: 100, currency: "USD", dir: 1 });
});

test("groups by dimension, counting multi-tag journals once per tag", () => {
  const flows = toFlows(groups, new Set(["1", "3"]), currencyOf);
  const tags = group(flows, keys.tag);
  expect(tags.map((row) => [row.label, row.totals.n])).toEqual([
    ["(no tags)", 3],
    ["trip", 1],
    ["fun", 1],
  ]);
  const categories = rank(group(flows, keys.category), "UAH", "out");
  expect(categories[0].label).toBe("(no category)");
  expect(matches(flows[0], "category", "7")).toBe(true);
  expect(matches(flows[3], "budget", "0")).toBe(false);
});

test("pivots into period columns", () => {
  const flows = toFlows(groups, new Set(["1"]), currencyOf);
  const rows = group(flows, keys.category, (flow) => flow.date.slice(0, 7));
  const none = rows.find((row) => row.key === "0");
  expect([...(none?.cells.keys() ?? [])]).toEqual(["2026-03", "2026-04"]);
  expect(amountOf(none?.cells.get("2026-04"), "UAH", "out")).toBe(20);
});

test("buckets cover the range", () => {
  expect(buckets("2025-11-15", "2026-02-02", "month")).toEqual([
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
  expect(buckets("2026-02-27", "2026-03-02", "day")).toEqual([
    "2026-02-27",
    "2026-02-28",
    "2026-03-01",
    "2026-03-02",
  ]);
  expect(buckets("2024-06-01", "2026-01-01", "year")).toEqual([
    "2024",
    "2025",
    "2026",
  ]);
  expect(
    bucketRange("2026-02", "month", { end: "2026-02-20", start: "2026-01-01" })
  ).toEqual({ end: "2026-02-20", start: "2026-02-01" });
});

test("top flows stay inside one currency", () => {
  const flows = toFlows(groups, new Set(["1"]), currencyOf);
  expect(topFlows(flows, "UAH", -1, 2).map((flow) => flow.amount)).toEqual([
    4000, 100,
  ]);
  expect(topFlows(flows, "USD", -1, 2)).toHaveLength(0);
});

test("aggregates a year of transactions quickly", () => {
  const many = Array.from({ length: 1500 }, (_, i) =>
    tx({
      amount: String(i),
      category_id: String(i % 7),
      category_name: `c${i % 7}`,
      date: `2026-${String((i % 12) + 1).padStart(2, "0")}-10T00:00:00+02:00`,
      tags: [`t${i % 5}`],
    })
  );
  const started = performance.now();
  const flows = toFlows(many, new Set(["1"]), currencyOf);
  group(flows, keys.category, (flow) => flow.date.slice(0, 7));
  group(flows, keys.tag);
  group(flows, keys.other);
  expect(performance.now() - started).toBeLessThan(50);
});

test("currency exchanges between selected accounts are kept apart", () => {
  const list = exchanges(groups, new Set(["1", "2"]), currencyOf);
  expect(list).toEqual([
    {
      date: "2026-03-05",
      from: "UAH",
      fromAmount: 4000,
      to: "USD",
      toAmount: 100,
    },
  ]);
});
