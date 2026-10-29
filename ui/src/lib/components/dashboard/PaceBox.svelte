<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import Box from "#lib/components/Box.svelte";
  import {
    addDays,
    daysBetween,
    parse,
    type Range,
    shiftPeriod,
    today,
  } from "#lib/dates.js";
  import { formatDate, formatMoney, toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { median } from "#lib/reports/typical.js";
  import { byCurrency, currency, type InsightEntry, span } from "./data.js";

  let { class: className = "" }: { class?: string } = $props();

  const MONTHS = 6;
  const MIN_MONTHS = 3;
  const SUFFIX: Record<string, string> = {
    few: "rd",
    one: "st",
    other: "th",
    two: "nd",
  };
  const ordinals = new Intl.PluralRules("en-US", { type: "ordinal" });

  const now = today();
  const cutoff = $derived(period.end < now ? period.end : now);
  const visible = $derived(cutoff >= period.start);
  const ranges = $derived.by(() => {
    const days = daysBetween(period.start, cutoff);
    const list: Range[] = [{ end: cutoff, start: period.start }];
    let { range } = period;
    for (let i = 0; i < MONTHS; i += 1) {
      range = shiftPeriod(range, period.view, -1);
      const end = addDays(range.start, days);
      list.push({ end: end < range.end ? end : range.end, start: range.start });
    }
    return list;
  });

  const pace = createQuery(() => ({
    enabled: visible,
    placeholderData: keepPreviousData,
    queryFn: () =>
      Promise.all(
        ranges.map((r) =>
          api<InsightEntry[]>("/v1/insight/expense/total", {
            query: span(r.start, r.end),
          })
        )
      ),
    queryKey: ["dashboard-pace", ranges.map((r) => r.start).join(), cutoff],
  }));

  const total = (list: InsightEntry[], code: string) =>
    Math.abs(
      list
        .filter((e) => e.currency_code === code)
        .reduce((s, e) => s + toNumber(e.difference), 0)
    );

  const rows = $derived.by(() => {
    const [current = [], ...past] = pace.data ?? [];
    const codes = [
      ...new Set([current, ...past].flat().map((e) => e.currency_code)),
    ];
    return byCurrency(codes, (code) => code)
      .map(([code]) => {
        const history = past
          .map((list) => total(list, code))
          .filter((v) => v > 0);
        const typical = history.length >= MIN_MONTHS ? median(history) : null;
        const spent = total(current, code);
        const cur = currency(code);
        return {
          code,
          format: (amount: number) => formatMoney({ amount, ...cur }),
          spent,
          typical,
        };
      })
      .filter((r) => r.spent > 0 || r.typical !== null);
  });

  const title = $derived.by(() => {
    if (period.view !== "1M") {
      return `Spent by ${formatDate(cutoff, "short")}`;
    }
    const day = parse(cutoff).getDate();
    return `Spent by the ${day}${SUFFIX[ordinals.select(day)] ?? "th"}`;
  });

  const all = $derived.by(() => {
    const lists = pace.data ?? [];
    const sums = lists.map((list) =>
      display.total(
        list.map((e) => ({ amount: e.difference, code: e.currency_code }))
      )
    );
    if (!display.active || lists.some((list, i) => list.length && !sums[i])) {
      return null;
    }
    const [spent = 0, ...past] = sums.map((sum) => Math.abs(sum?.amount ?? 0));
    const history = past.filter((v) => v > 0);
    const approx = sums.some((sum) => sum?.converted);
    return {
      code: "All",
      format: (amount: number) =>
        `${approx ? "≈" : ""}${formatMoney({ ...display.target, amount, decimals: 0 })}`,
      spent,
      typical: history.length >= MIN_MONTHS ? median(history) : null,
    };
  });
  const lines = $derived(all ? [all] : rows);
</script>

{#if visible && rows.length > 0}
  <Box body="p-0" class={className} {title}>
    {#snippet tools()}
      <span class="text-[12px] text-cladd-fg-soft"
        >Typical: median of {MONTHS} months</span
      >
    {/snippet}
    <table
      class="w-full border-collapse text-[13px] transition-opacity {pace.isPlaceholderData
        ? "opacity-60"
        : ""}"
    >
      <thead>
        <tr class="h-7 text-[11px] text-cladd-fg-soft">
          <th class="pl-3 text-left font-normal" scope="col">Currency</th>
          <th class="px-2 text-right font-normal" scope="col">Spent</th>
          <th class="px-2 text-right font-normal" scope="col">Typical</th>
          <th class="px-2 text-right font-normal" scope="col">Difference</th>
          <th class="hidden w-full pr-3 font-normal sm:table-cell" scope="col">
            <span class="sr-only">Spent against typical</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {#each lines as r (r.code)}
          {@const diff = r.typical === null ? null : r.spent - r.typical}
          {@const scale = Math.max(r.spent, r.typical ?? 0) || 1}
          <tr class="h-7 border-cladd-outline/60 border-t">
            <th
              class="pl-3 text-left font-semibold text-[12px] text-cladd-fg"
              scope="row"
            >
              {r.code}
            </th>
            <td
              class="num whitespace-nowrap px-2 text-right font-semibold text-cladd-fg"
            >
              {r.format(r.spent)}
            </td>
            <td
              class="num whitespace-nowrap px-2 text-right text-cladd-fg-soft"
            >
              {r.typical === null ? "n/a" : r.format(r.typical)}
            </td>
            <td
              class="num px-2 text-right sm:whitespace-nowrap {diff !== null &&
              diff > 0
                ? "text-expense"
                : "text-income"}"
            >
              {#if diff !== null}
                {r.format(Math.abs(diff))}
                {diff > 0 ? "over" : "under"}
              {/if}
            </td>
            <td class="hidden pr-3 pl-2 sm:table-cell">
              {#if r.typical !== null}
                <div
                  class="relative h-2 min-w-24 max-w-80 rounded-full bg-cladd-surface-next"
                >
                  <span
                    class="absolute inset-y-0 left-0 rounded-full {diff !==
                      null && diff > 0
                      ? "bg-expense"
                      : "bg-brand"}"
                    style:width="{(r.spent / scale) * 100}%"
                  ></span>
                  <span
                    class="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-cladd-fg"
                    style:left="{(r.typical / scale) * 100}%"
                  ></span>
                </div>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Box>
{/if}
