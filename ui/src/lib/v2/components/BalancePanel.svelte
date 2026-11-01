<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import type { Snippet } from "svelte";
  import { stepPeriod } from "#lib/dates.js";
  import { period } from "#lib/period.svelte.js";
  import { q } from "../data.js";
  import { view } from "../money.svelte.js";
  import { seriesOf } from "../stats.js";
  import { daysIn, periodName } from "../when.js";
  import BalanceChart from "./BalanceChart.svelte";

  let {
    label,
    accounts,
    total = null,
    height = 300,
    showValue = true,
    fill = false,
    picker,
  }: {
    label: string;
    accounts?: string[];
    total?: number | null;
    height?: number;
    showValue?: boolean;
    fill?: boolean;
    picker?: Snippet;
  } = $props();

  const prev = $derived(stepPeriod(period.range, period.view, -1));
  const chart = createQuery(() => q.chart(period.start, period.end, accounts));
  const ghostChart = createQuery(() => q.chart(prev.start, prev.end, accounts));

  const series = $derived(view.ready ? seriesOf(chart.data, period.start, period.end) : []);
  const ghost = $derived(view.ready ? seriesOf(ghostChart.data, prev.start, prev.end) : []);
  const change = $derived(series.length > 1 ? series[series.length - 1].value - series[0].value : 0);
  const value = $derived(total ?? series.at(-1)?.value ?? 0);
  const show = (v: number) => view.show(v);
  let room = $state(0);
  const chartHeight = $derived(fill ? Math.max(height, room) : height);
</script>

<section class="panel worth" class:fill>
  <div class="head">
    <div>
      <div class="label-row">
        <span class="small label">{label}</span>
        {@render picker?.()}
      </div>
      {#if chart.isPending || !view.ready}
        <div class="skeleton" style="width: 320px; height: 66px; margin-top: 8px"></div>
      {:else}
        {#if showValue}<div class="big amount" data-copy>{show(value)}</div>{/if}
        <div class="delta">
          <span class:neg={change < 0} class:pos={change > 0}>{view.show(change, { signed: true })}</span>
          <span class="muted">this period</span>
        </div>
      {/if}
    </div>
    <div class="legend small">
      <span><i class="solid"></i>{periodName(period.start, period.end)}</span>
      <span><i class="dash"></i>{periodName(prev.start, prev.end)}</span>
    </div>
  </div>
  {#if chart.isPending}
    <div class="skeleton" style:height="{height}px" style:margin-top="26px"></div>
  {:else}
    <div bind:clientHeight={room} class="plot">
      <BalanceChart format={show} {ghost} height={chartHeight} points={series} slots={daysIn(period.start, period.end).length} />
    </div>
  {/if}
</section>

<style>
  .worth {
    padding: 28px 30px 22px;
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .label-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
  }
  .label {
    font-size: 14px;
  }
  .amount {
    font-size: 56px;
    margin-top: 4px;
  }
  .delta {
    font-size: 14.5px;
    font-weight: 700;
    margin-top: 10px;
    display: flex;
    gap: 6px;
  }
  .delta .muted {
    font-weight: 600;
  }
  .legend {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    white-space: nowrap;
  }
  .legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 14px;
    display: inline-block;
  }
  .solid {
    height: 3px;
    border-radius: 2px;
    background: var(--acc);
  }
  .dash {
    border-top: 2px dashed var(--faint);
  }
  .plot {
    margin-top: 26px;
  }
  .fill {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .fill .plot {
    flex: 1;
    position: relative;
    min-height: 260px;
  }
  @media (max-width: 760px) {
    .worth {
      padding: 18px 18px 12px;
    }
    .amount {
      font-size: 40px;
    }
    .legend {
      display: none;
    }
    .plot {
      margin-top: 14px;
    }
    .fill .plot {
      min-height: 170px;
    }
  }
  .fill .plot :global(.chart) {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
  }
</style>
