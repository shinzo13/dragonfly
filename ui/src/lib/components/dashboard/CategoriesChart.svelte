<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { lists } from "#lib/api/lists.js";
  import Box from "#lib/components/Box.svelte";
  import BarChart from "#lib/components/charts/BarChart.svelte";
  import { type Bar, tones } from "#lib/components/charts/chart.js";
  import { toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import {
    axis,
    byCurrency,
    type ChartSet,
    type Cur,
    hasPrimary,
    mergeable,
    money,
    proportional,
    setCurrency,
    setPrimary,
    span,
  } from "./data.js";

  const NO_CATEGORY = "/categories/list/no-category";

  const chart = createQuery(() => ({
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<ChartSet[]>("/v1/chart/category/overview", {
        query: span(period.start, period.end),
      }),
    queryKey: ["chart-categories", period.start, period.end],
  }));
  const categories = createQuery(() => lists.categories());

  const ids = $derived(
    new Map((categories.data ?? []).map((c) => [c.attributes.name, c.id]))
  );
  const sets = $derived(chart.data ?? []);
  const converted = $derived(hasPrimary(sets));
  const curOf = (s: ChartSet) => (converted ? setPrimary(s) : setCurrency(s));
  const merged = $derived(mergeable(sets.map((s) => curOf(s).code)));

  function group(code: string, label: string, cur: Cur, list: ChartSet[]) {
    const totals = new Map<string, number>();
    for (const s of list) {
      const entries = (converted ? s.pc_entries : s.entries) as Record<
        string,
        string
      >;
      const rate = merged ? (display.rate(curOf(s).code) ?? 1) : 1;
      const spent = Math.abs(toNumber(entries?.spent)) * rate;
      totals.set(s.label, (totals.get(s.label) ?? 0) + spent);
    }
    const bars: Bar[] = [...totals]
      .map(([name, value]) => {
        const id = ids.get(name);
        return {
          href: id ? `/categories/show/${id}` : NO_CATEGORY,
          key: name,
          label: name,
          value,
        };
      })
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);
    return { bars, code, cur, label };
  }

  const groups = $derived(
    merged
      ? [group(display.code, `≈${display.code}`, display.target, sets)]
      : byCurrency(sets, (s) => curOf(s).code).map(([code, list]) =>
          group(code, code, curOf(list[0]), list)
        )
  );
  const visible = $derived(groups.filter((g) => g.bars.length > 0));
</script>

<Box href="/categories" title="Categories">
  <div
    class="grid gap-x-6 gap-y-5 transition-opacity md:grid-cols-(--cols) {chart.isPlaceholderData
      ? "opacity-60"
      : ""}"
    style:--cols={proportional(visible.map((g) => g.bars.length))}
  >
    {#if chart.isPending}
      <div class="h-60"></div>
    {:else if chart.isError}
      <p class="text-expense">{chart.error.message}</p>
    {:else if visible.length === 0}
      <p class="py-10 text-center text-cladd-fg-soft">
        Nothing spent in this period. Expenses show up here by category.
      </p>
    {:else}
      {#each visible as group (group.code)}
        <div class="flex min-w-0 flex-col gap-1">
          {#if visible.length > 1 || merged}
            <span
              class="font-semibold text-[11px] text-cladd-fg-soft tracking-wide"
              >Spent in {group.label}</span
            >
          {/if}
          <BarChart
            axisFormat={axis(group.cur)}
            bars={group.bars}
            color={tones.expense}
            format={money(group.cur)}
            height={240}
            label="Spent per category in {group.code}"
            name="Spent"
          />
        </div>
      {/each}
    {/if}
  </div>
  {#snippet footer()}
    <a
      class="text-brand dark:text-(--ff-series-1) hover:underline"
      href="/categories"
      >Go to your categories</a
    >
  {/snippet}
</Box>
