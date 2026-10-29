import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
import { lists } from "#lib/api/lists.js";
import type { TransactionGroup } from "#lib/api/types.js";
import { today } from "#lib/dates.js";
import { display } from "#lib/money/display.svelte.js";
import { period } from "#lib/period.svelte.js";
import type { Flow } from "#lib/reports/flows.js";
import { ledgerQuery, ledgerWindow, ownFlows } from "#lib/reports/ledger.js";
import { pages } from "#lib/reports/queries.js";
import { impliedRates } from "#lib/reports/rates.js";
import { typicalMonths } from "#lib/reports/typical.js";
import { session } from "#lib/session.svelte.js";
import { board, type Kind, monthDay } from "./merchants.js";

export function useMerchants(kind: () => Kind) {
  const now = today();
  const current = ledgerWindow(now);
  const anchor = $derived(period.end >= current.start ? now : period.end);
  const window = $derived(ledgerWindow(anchor));
  const inside = $derived(
    period.start >= window.start && period.end <= window.end
  );

  const accounts = createQuery(() => lists.accounts("all"));
  const ledger = createQuery(() => ({
    ...ledgerQuery(anchor),
    placeholderData: keepPreviousData,
  }));
  const extra = createQuery(() => ({
    enabled: !inside,
    placeholderData: keepPreviousData,
    queryFn: () =>
      pages<TransactionGroup>("/v1/transactions", {
        end: period.end,
        start: period.start,
        type: "default",
      }),
    queryKey: ["merchants-period", period.start, period.end],
  }));

  const own = $derived(
    ledger.data && accounts.data ? ownFlows(ledger.data, accounts.data) : []
  );
  const ownPeriod = $derived.by(() => {
    if (inside) {
      return own;
    }
    return extra.data && accounts.data
      ? ownFlows(extra.data, accounts.data)
      : [];
  });
  const rates = $derived.by(() => {
    if (!display.active) {
      return null;
    }
    const map = new Map<string, number>();
    for (const code of new Set([...own, ...ownPeriod].map((f) => f.currency))) {
      const rate = display.rate(code);
      if (rate === null) {
        return null;
      }
      map.set(code, rate);
    }
    return map;
  });
  const merge = $derived(rates ? display.code : null);
  const inTarget = (list: Flow[]) =>
    rates
      ? list.map((flow) => ({
          ...flow,
          amount: flow.amount * (rates.get(flow.currency) ?? 0),
        }))
      : list;
  const flows = $derived(inTarget(own));
  const periodFlows = $derived(inside ? flows : inTarget(ownPeriod));
  const implied = $derived(impliedRates(ledger.data ?? []));
  const day = $derived(monthDay(period.range, now));
  const result = $derived.by(() => {
    if (!(accounts.data && ledger.data && (inside || extra.data))) {
      return null;
    }
    const month = period.end.slice(0, 7);
    const since = flows.reduce(
      (first, flow) => (flow.date < first ? flow.date : first),
      now
    );
    const base = merge ?? session.primary?.code ?? "";
    return board(accounts.data, flows, periodFlows, {
      day,
      kind: kind(),
      merge,
      months: window.months.filter((m) => m <= month),
      past: typicalMonths(window.months, period.end, since),
      range: period.range,
      rate: (code) => implied(code, base) ?? 0,
    });
  });

  return {
    get board() {
      return result;
    },
    get day() {
      return day;
    },
    get error() {
      return accounts.error ?? ledger.error ?? extra.error ?? null;
    },
    get loading() {
      return result === null;
    },
    get stale() {
      return ledger.isFetching || extra.isPlaceholderData;
    },
  };
}
