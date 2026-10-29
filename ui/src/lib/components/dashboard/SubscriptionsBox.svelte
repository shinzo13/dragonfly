<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { all } from "#lib/api/lists.js";
  import type { Bill } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import Meter from "#lib/components/charts/Meter.svelte";
  import { today } from "#lib/dates.js";
  import { formatDate, formatMoney, toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { parseSummary, rough, span, summaryQuery } from "./data.js";

  const DUE_LIMIT = 6;

  const summary = createQuery(() => ({
    ...summaryQuery(period.start, period.end),
    placeholderData: keepPreviousData,
  }));
  const bills = createQuery(() => ({
    placeholderData: keepPreviousData,
    queryFn: () => all<Bill>("/v1/bills", span(period.start, period.end)),
    queryKey: ["bills", period.start, period.end],
  }));

  const parsed = $derived(parseSummary(summary.data));
  const meters = $derived(
    (parsed["bills-paid"] ?? [])
      .map((p) => {
        const u = parsed["bills-unpaid"]?.find((e) => e.code === p.code);
        const paid = Math.abs(p.amount);
        const unpaid = Math.abs(u?.amount ?? 0);
        return { cur: p, paid, total: paid + unpaid };
      })
      .concat(
        (parsed["bills-unpaid"] ?? [])
          .filter((u) => !parsed["bills-paid"]?.some((p) => p.code === u.code))
          .map((u) => ({ cur: u, paid: 0, total: Math.abs(u.amount) }))
      )
      .filter((m) => m.total > 0)
  );
  const lines = $derived.by(() => {
    const paid = meters.map((m) => ({ ...m.cur, amount: m.paid }));
    const left = meters.map((m) => ({ ...m.cur, amount: m.total - m.paid }));
    const sumPaid = display.total(paid);
    const sumLeft = display.total(left);
    if (sumPaid && sumLeft) {
      return [
        {
          key: display.code,
          left: display.text(left),
          max: sumPaid.amount + sumLeft.amount,
          paid: display.text(paid),
          value: sumPaid.amount,
        },
      ];
    }
    return meters.map((m, i) => ({
      key: m.cur.code,
      left: formatMoney(left[i]),
      max: m.total,
      paid: formatMoney(paid[i]),
      value: m.paid,
    }));
  });
  const inPeriod = (dates: (string | null | undefined)[]) =>
    dates
      .map((d) => (d ?? "").slice(0, 10))
      .filter((d) => d >= period.start && d <= period.end)
      .sort();
  const due = $derived(
    (bills.data ?? [])
      .filter((b) => b.attributes.active !== false)
      .flatMap((b) => {
        const expected = inPeriod(b.attributes.pay_dates ?? []);
        const paid = inPeriod(
          (b.attributes.paid_dates ?? []).map((p) => p.date)
        ).length;
        const next = expected[paid];
        if (!next || next >= today()) {
          return [];
        }
        const amount =
          (toNumber(b.attributes.amount_min) +
            toNumber(b.attributes.amount_max)) /
          2;
        return [{ amount, bill: b, date: next }];
      })
      .sort((x, y) => x.date.localeCompare(y.date))
  );
</script>

{#if (bills.data?.length ?? 0) > 0}
  <Box href="/subscriptions" title="Subscriptions">
    <div
      class="flex flex-col gap-3 transition-opacity {summary.isPlaceholderData
        ? "opacity-60"
        : ""}"
    >
      {#if meters.length === 0}
        <p class="text-cladd-fg-soft">Nothing expected in this period.</p>
      {:else}
        <ul class="flex flex-col gap-2">
          {#each lines as m (m.key)}
            <li class="flex flex-col gap-1">
              <div
                class="flex items-baseline justify-between gap-2 text-[12px]"
              >
                <span class="text-cladd-fg-soft"
                  ><span class="num text-cladd-fg">{m.paid}</span>
                  paid</span
                >
                <span class="text-cladd-fg-soft"
                  ><span class="num text-cladd-fg">{m.left}</span>
                  to pay</span
                >
              </div>
              <Meter
                max={m.max}
                segments={[{ color: "var(--ff-series-3)", value: m.value }]}
              />
            </li>
          {/each}
        </ul>
      {/if}
      {#if due.length > 0}
        <div class="flex flex-col">
          <span class="pb-1 font-semibold text-[12px] text-cladd-fg-soft"
            >Not paid yet</span
          >
          <ul class="flex flex-col">
            {#each due.slice(0, DUE_LIMIT) as d (d.bill.id)}
              <li>
                <a
                  class="-mx-1 flex h-10 items-center gap-2 rounded-sm px-1 text-[12.5px] sm:h-7 hover:bg-row-hover"
                  href="/subscriptions/show/{d.bill.id}"
                >
                  <span class="num w-12 shrink-0 text-cladd-fg-soft"
                    >{formatDate(d.date, "short")}</span
                  >
                  <span class="min-w-0 flex-1 truncate"
                    >{d.bill.attributes.name}</span
                  >
                  <span class="num text-cladd-fg-soft"
                    >{rough([
                      {
                        amount: d.amount,
                        code: d.bill.attributes.currency_code,
                        decimals: d.bill.attributes.currency_decimal_places,
                        symbol: d.bill.attributes.currency_symbol,
                      },
                    ])}</span
                  >
                </a>
              </li>
            {/each}
          </ul>
          {#if due.length > DUE_LIMIT}
            <a
              class="pt-1 text-[12px] text-cladd-fg-soft hover:underline"
              href="/subscriptions"
              >and {due.length - DUE_LIMIT} more</a
            >
          {/if}
        </div>
      {/if}
    </div>
    {#snippet footer()}
      <a
        class="text-brand dark:text-(--ff-series-1) hover:underline"
        href="/subscriptions"
        >Go to your subscriptions</a
      >
    {/snippet}
  </Box>
{/if}
