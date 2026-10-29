<script lang="ts">
  import type { Range } from "#lib/dates.js";
  import { period, periodLabel } from "#lib/period.svelte.js";
  import MoneyList from "./MoneyList.svelte";
  import { list, type PeriodTotals } from "./sums.js";

  export type Field = "spent" | "earned" | "transferred";

  const LABELS: Record<Field, string> = {
    earned: "Earned",
    spent: "Spent",
    transferred: "Transferred",
  };

  let {
    periods,
    href,
    fields = ["spent", "earned", "transferred"],
  }: {
    periods: PeriodTotals[];
    href: (range: Range) => string;
    fields?: Field[];
  } = $props();
</script>

<nav
  aria-label="Periods"
  class="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2 2xl:grid-cols-1"
>
  {#each periods as item (item.range.start)}
    {@const current =
      item.range.start === period.start && item.range.end === period.end}
    <a
      aria-current={current ? "page" : undefined}
      class="cladd-surface cladd-outline flex flex-col gap-0.5 rounded-cladd-md px-3 py-2 text-[12px] {current
        ? "bg-row-cursor outline-2 outline-brand"
        : "hover:bg-row-hover"}"
      href={href(item.range)}
    >
      <span class="font-semibold text-cladd-fg"
        >{periodLabel(item.range, period.view)}</span
      >
      {#if item.totals.count === 0}
        <span class="text-cladd-fg-softer">No transactions</span>
      {:else}
        <span class="flex justify-between gap-2">
          <span class="text-cladd-fg-soft">Transactions</span>
          <span class="num text-cladd-fg">{item.totals.count}</span>
        </span>
        {#each fields as field (field)}
          {@const sums = list(item.totals[field])}
          {#if sums.length > 0}
            <span class="flex justify-between gap-2">
              <span class="text-cladd-fg-soft">{LABELS[field]}</span>
              <MoneyList
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
