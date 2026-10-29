/// <reference types="bun" />
import { expect, test } from "bun:test";
import type { Bill } from "#lib/api/types.js";
import { expectedDates } from "./bills.js";

test("monthly bills land once per month", () => {
  const bill = {
    date: "2025-11-03T00:00:00+01:00",
    repeat_freq: "monthly",
    skip: 0,
  } as Bill;
  expect(
    expectedDates(bill, { end: "2026-09-30", start: "2026-09-01" })
  ).toEqual(["2026-09-03"]);
});

test("skip and end date are honoured", () => {
  const bill = {
    date: "2026-01-31",
    end_date: "2026-06-01",
    repeat_freq: "monthly",
    skip: 1,
  } as Bill;
  expect(
    expectedDates(bill, { end: "2026-12-31", start: "2026-01-01" })
  ).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
});
