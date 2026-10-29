/// <reference types="bun" />
import { expect, test } from "bun:test";
import {
  fiscalYear,
  grainOf,
  parseReport,
  parseReportDate,
  reportPath,
  templateOf,
} from "./params.js";

const NOW = "2026-10-16";

test("parses Firefly dates and magic words", () => {
  expect(parseReportDate("20260101", "01-01", NOW)).toBe("2026-01-01");
  expect(parseReportDate("2026-02-03", "01-01", NOW)).toBe("2026-02-03");
  expect(parseReportDate("20260231", "01-01", NOW)).toBeNull();
  expect(parseReportDate("currentMonthStart", "01-01", NOW)).toBe("2026-10-01");
  expect(parseReportDate("currentMonthEnd", "01-01", NOW)).toBe("2026-10-31");
  expect(parseReportDate("previousMonthStart", "01-01", NOW)).toBe(
    "2026-09-01"
  );
  expect(parseReportDate("previousMonthEnd", "01-01", NOW)).toBe("2026-09-30");
  expect(parseReportDate("previousYearEnd", "01-01", NOW)).toBe("2025-12-31");
  expect(parseReportDate("currentFiscalYearStart", "04-01", NOW)).toBe(
    "2026-04-01"
  );
  expect(parseReportDate("previousFiscalYearEnd", "04-01", NOW)).toBe(
    "2026-03-31"
  );
});

test("fiscal year wraps around the start day", () => {
  expect(fiscalYear("2026-02-10", "04-01")).toEqual({
    end: "2026-03-31",
    start: "2025-04-01",
  });
});

test("round-trips a report path", () => {
  const parsed = parseReport("category", "1,2/5,7/20260101/20261231");
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.params).toEqual({
      accounts: ["1", "2"],
      end: "2026-12-31",
      items: ["5", "7"],
      start: "2026-01-01",
      type: "category",
    });
    expect(reportPath(parsed.params)).toBe(
      "/reports/category/1,2/5,7/20260101/20261231"
    );
  }
});

test("rejects bad addresses like Firefly does", () => {
  expect(parseReport("nope", "1/20260101/20260131").ok).toBe(false);
  expect(parseReport("default", "1/20260201/20260101").ok).toBe(false);
  expect(parseReport("budget", "1/20260101/20260131").ok).toBe(false);
  const swapped = parseReport("double", "1/9/20260201/20260101");
  expect(swapped.ok && swapped.params.start).toBe("2026-01-01");
});

test("keeps magic list words for the page to resolve", () => {
  const parsed = parseReport(
    "tag",
    "allAssetAccounts/allTags/20260101/20260131"
  );
  expect(parsed.ok && parsed.params.accounts).toEqual(["allAssetAccounts"]);
  expect(parsed.ok && parsed.params.items).toEqual(["allTags"]);
});

test("picks grain and template like Firefly", () => {
  expect(grainOf("2026-10-01", "2026-10-31")).toBe("day");
  expect(templateOf("2026-10-01", "2026-10-31")).toBe("month");
  expect(grainOf("2026-01-01", "2026-12-31")).toBe("month");
  expect(templateOf("2026-01-01", "2026-12-31")).toBe("year");
  expect(templateOf("2026-01-01", "2026-02-28")).toBe("year");
  expect(grainOf("2025-01-01", "2026-12-31")).toBe("year");
  expect(templateOf("2025-01-01", "2026-12-31")).toBe("multi-year");
});
