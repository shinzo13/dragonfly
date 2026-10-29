<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { all } from "#lib/api/lists.js";
  import type { TransactionGroup } from "#lib/api/types.js";
  import MoneyList from "#lib/components/categories/MoneyList.svelte";
  import {
    byPeriod,
    list,
    periodRanges,
    rows,
    SIDEBAR_PERIODS,
  } from "#lib/components/categories/sums.js";
  import type { Range } from "#lib/dates.js";
  import { period, periodLabel } from "#lib/period.svelte.js";
  import { debtMove, listPath } from "#lib/transactions/split.js";

  const FIELDS = [
    ["spent", "Spent", "withdrawal"],
    ["earned", "Earned", "deposit"],
    ["transferred", "Transferred", "transfer"],
  ] as const;

  let { type, class: className = "" }: { type: string; class?: string } =
    $props();

  const ranges = $derived(
    periodRanges(period.end, period.view, SIDEBAR_PERIODS)
  );
  const first = $derived(ranges.at(-1)?.start ?? period.start);
  const last = $derived(ranges[0]?.end ?? period.end);

  const query = createQuery(() => ({
    placeholderData: keepPreviousData,
    queryFn: async () => ({
      first,
      groups: await all<TransactionGroup>("/v1/transactions", {
        end: last,
        start: first,
        type,
      }),
      last,
    }),
    queryKey: ["transactions-periods", type, first, last],
  }));

  const shown = $derived(
    ranges.filter((range) => !period.first || range.end >= period.first)
  );
  const counts = $derived(
    byPeriod(rows(query.data?.groups ?? []), shown).map(
      (item) => item.totals.count
    )
  );
  const periods = $derived(
    byPeriod(
      rows(query.data?.groups ?? [], (split) => !debtMove(split)),
      shown
    )
  );
  const fields = $derived(
    FIELDS.filter(([, , kind]) => type === "all" || type === kind)
  );

  function covered(range: Range) {
    const { data } = query;
    return Boolean(data && data.first <= range.start && range.end <= data.last);
  }

  const href = (range: Range) =>
    `${listPath(type)}?start=${range.start}&end=${range.end}`;
</script>

<nav
  aria-label="Periods"
  class="grid min-w-0 auto-rows-[0] grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] grid-rows-[auto] gap-x-2 overflow-hidden min-[1600px]:flex min-[1600px]:flex-col min-[1600px]:gap-2 min-[1600px]:overflow-visible {className}"
>
  {#each periods as item, index (item.range.start)}
    {@const current =
      item.range.start === period.start && item.range.end === period.end}
    <a
      aria-current={current ? "page" : undefined}
      class="cladd-surface cladd-outline flex min-w-0 flex-col gap-0.5 rounded-cladd-md px-3 py-2 text-[12px] {current
        ? "bg-row-cursor outline-2 outline-brand -outline-offset-2"
        : "hover:bg-row-hover"}"
      href={href(item.range)}
    >
      <span class="font-semibold text-brand"
        >{periodLabel(item.range, period.view)}</span
      >
      {#if !covered(item.range)}
        <span class="text-cladd-fg-softer">Loading...</span>
      {:else if counts[index] === 0}
        <span class="text-cladd-fg-softer">No transactions</span>
      {:else}
        <span class="flex justify-between gap-2">
          <span class="text-cladd-fg-soft">Transactions</span>
          <span class="num text-cladd-fg">{counts[index]}</span>
        </span>
        {#each fields as [field, label] (field)}
          {@const sums = list(item.totals[field])}
          {#if sums.length > 0}
            <span class="flex justify-between gap-2">
              <span class="text-cladd-fg-soft">{label}</span>
              <MoneyList
                class="flex-col items-end"
                {sums}
                tone={field === "transferred" ? "transfer" : "auto"}
              />
            </span>
          {/if}
        {/each}
      {/if}
    </a>
  {/each}
</nav>
