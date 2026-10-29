<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import Box from "#lib/components/Box.svelte";
  import type { LinePoint, LineSeries } from "#lib/components/charts/chart.js";
  import LineChart from "#lib/components/charts/LineChart.svelte";
  import { contains, today } from "#lib/dates.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    accountsChartQuery,
    accountsQuery,
    axis,
    byCurrency,
    type ChartSet,
    type Cur,
    hasPrimary,
    hrefWith,
    mergeable,
    money,
    seriesPoints,
    setCurrency,
    setPrimary,
  } from "./data.js";

  const HEIGHT = 330;
  const MIN_PANEL = 130;

  const mode = $derived(
    page.url.searchParams.get("chart") === "net-worth"
      ? "net-worth"
      : "accounts"
  );
  const chart = createQuery(() => ({
    ...accountsChartQuery(period.start, period.end, mode === "net-worth"),
    placeholderData: keepPreviousData,
  }));
  const assets = createQuery(() => ({
    ...accountsQuery("asset", period.start, period.end),
    enabled: mode === "net-worth",
  }));
  const liabilities = createQuery(() => ({
    ...accountsQuery("liabilities", period.start, period.end),
    enabled: mode === "net-worth",
  }));

  let cursor = $state<string | null>(null);

  const sets = $derived(chart.data ?? []);
  const converted = $derived(hasPrimary(sets));
  const excluded = $derived(
    new Set(
      [...(assets.data ?? []), ...(liabilities.data ?? [])]
        .filter((a) => a.attributes.include_net_worth === false)
        .map((a) => a.attributes.name)
    )
  );

  interface Panel {
    cur: Cur;
    label: string;
    series: LineSeries[];
  }

  const curOf = (s: ChartSet) => (converted ? setPrimary(s) : setCurrency(s));
  const merged = $derived(mergeable(sets.map((s) => curOf(s).code)));

  function points(set: ChartSet): LinePoint[] {
    const rate = merged ? (display.rate(curOf(set).code) ?? 1) : 1;
    return seriesPoints(set, converted).map((p) => ({ x: p.x, y: p.y * rate }));
  }

  function sum(group: ChartSet[]): LinePoint[] {
    const totals = new Map<string, number>();
    for (const set of group) {
      for (const p of points(set)) {
        totals.set(p.x, (totals.get(p.x) ?? 0) + p.y);
      }
    }
    return [...totals.entries()].map(([x, y]) => ({ x, y }));
  }

  function panel(cur: Cur, label: string, group: ChartSet[]): Panel {
    const format = money(cur);
    if (mode === "net-worth") {
      const included = group.filter((s) => !excluded.has(s.label));
      return {
        cur,
        label,
        series: [
          {
            area: true,
            format,
            key: "net-worth",
            label: `Net worth (${label})`,
            points: sum(included),
            strong: true,
          },
        ],
      };
    }
    return {
      cur,
      label,
      series: group.map((s) => ({
        area: group.length === 1,
        format,
        key: s.label,
        label: s.label,
        points: points(s),
      })),
    };
  }

  const panels = $derived<Panel[]>(
    merged
      ? [panel(display.target, `≈${display.code}`, sets)]
      : byCurrency(sets, (s) => curOf(s).code).map(([code, group]) =>
          panel(curOf(group[0]), code, group)
        )
  );
  const panelHeight = $derived(
    Math.max(MIN_PANEL, Math.floor(HEIGHT / Math.max(1, panels.length)))
  );
  const marker = $derived(
    contains(period.range, today()) ? today() : undefined
  );

  function setMode(next: string) {
    goto(hrefWith(page.url, { chart: next === "accounts" ? null : next }), {
      replace: true,
    });
  }
</script>

<Box href="/accounts/asset" title="Your accounts">
  {#snippet tools()}
    <fieldset
      class="cladd-cut m-0 flex min-w-0 rounded-cladd-sm border-0 p-0.5 text-[12px]"
    >
      <legend class="sr-only">Chart shows</legend>
      {#each [
        ["accounts", "Accounts"],
        ["net-worth", "Net worth"],
      ] as [value, text] (value)}
        <button
          aria-pressed={mode === value}
          class="rounded-[5px] px-2 py-0.5 {mode === value
            ? "cladd-surface cladd-outline font-semibold text-cladd-fg"
            : "text-cladd-fg-soft hover:text-cladd-fg"}"
          onclick={() => setMode(value)}
          type="button"
        >
          {text}
        </button>
      {/each}
    </fieldset>
  {/snippet}
  <div
    class="flex flex-col gap-5 transition-opacity {chart.isPlaceholderData
      ? "opacity-60"
      : ""}"
  >
    {#if chart.isPending}
      <div style:height="{HEIGHT}px"></div>
    {:else if chart.isError}
      <p class="text-expense">{chart.error.message}</p>
    {:else if panels.length === 0}
      <p class="py-10 text-center text-cladd-fg-soft">
        No accounts to draw. Pick the accounts for this chart in
        <a
          class="text-brand dark:text-(--ff-series-1) underline"
          href="/preferences"
          >Preferences</a
        >.
      </p>
    {:else}
      {#each panels as panel (panel.cur.code)}
        <div class="flex flex-col gap-1">
          {#if panels.length > 1 || merged}
            <span
              class="font-semibold text-[11px] text-cladd-fg-soft tracking-wide"
              >{panel.label}</span
            >
          {/if}
          <LineChart
            axisFormat={axis(panel.cur)}
            height={panelHeight}
            label="{mode === "net-worth"
              ? "Net worth"
              : "Account balances"} in {panel.cur.code}"
            {marker}
            series={panel.series}
            bind:cursor
          />
        </div>
      {/each}
    {/if}
  </div>
  {#snippet footer()}
    <a
      class="text-brand dark:text-(--ff-series-1) hover:underline"
      href="/accounts/asset"
      >View your asset accounts</a
    >
    {#if converted && !merged}
      <span class="ml-auto text-cladd-fg-soft"
        >Converted to your primary currency</span
      >
    {/if}
  {/snippet}
</Box>
