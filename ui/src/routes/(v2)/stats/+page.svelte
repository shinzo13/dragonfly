<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { addDays } from "#lib/dates.js";
  import { period } from "#lib/period.svelte.js";
  import { q } from "#lib/v2/data.js";
  import { view } from "#lib/v2/money.svelte.js";
  import FlowChart from "#lib/v2/stats/FlowChart.svelte";
  import Heat from "#lib/v2/stats/Heat.svelte";
  import { byTag, days, flow, lastDay, monthsUpTo, places } from "#lib/v2/stats/model.js";
  import Places from "#lib/v2/stats/Places.svelte";
  import TagMap from "#lib/v2/stats/TagMap.svelte";
  import { toRow } from "#lib/v2/tx.js";
  import { periodName } from "#lib/v2/when.js";

  const allMonths = $derived(monthsUpTo(period.end, 12));
  const from = $derived(addDays(lastDay(period.end), -372) < allMonths[0].start ? addDays(lastDay(period.end), -372) : allMonths[0].start);
  const to = $derived(allMonths[allMonths.length - 1].end);

  const year = createQuery(() => q.transactions(from, to));
  const current = createQuery(() => q.transactions(period.start, period.end));

  const yearRows = $derived((year.data ?? []).map(toRow));
  const months = $derived.by(() => {
    if (!view.ready) {
      return allMonths;
    }
    const all = flow(yearRows, allMonths);
    const peak = Math.max(1, ...all.map((d) => d.earned + d.spent));
    const at = all.findIndex((d) => d.earned + d.spent > peak * 0.05);
    return allMonths.slice(Math.min(at < 0 ? 0 : at, allMonths.length - 3));
  });
  const rows = $derived((current.data ?? []).map(toRow));

  const flowData = $derived(view.ready ? flow(yearRows, months) : []);
  const tagData = $derived(view.ready ? byTag(rows) : []);
  const placeData = $derived(view.ready ? places(rows).slice(0, 6) : []);
  const dayData = $derived(view.ready ? days(yearRows) : new Map());

  const full = $derived(flowData.filter((d) => d.month.end < lastDay(period.end) || d.month.end === period.end));
  const avgSaved = $derived(full.length ? full.reduce((s, d) => s + d.earned - d.spent, 0) / full.length : 0);
  const avgSpent = $derived(full.length ? full.reduce((s, d) => s + d.spent, 0) / full.length : 0);
  const name = $derived(periodName(period.start, period.end));
  const loading = $derived(year.isPending || !view.ready);
</script>

<svelte:head><title>Stats · Dragonfly</title></svelte:head>

<div class="stats">
  <div class="row top">
    <section class="panel col">
      <div class="head">
        <div>
          <h1>Inside the receipts</h1>
          <div class="small">spending by tag · {name}</div>
        </div>
      </div>
      {#if current.isPending || !view.ready}
        <div class="skeleton" style="height: 300px"></div>
      {:else if tagData.length}
        <TagMap data={tagData} />
      {:else}
        <p class="empty">No tagged purchases in {name}.</p>
      {/if}
    </section>
    <section class="panel col">
      <div class="head">
        <div>
          <h1>Top places</h1>
          <div class="small">{name}</div>
        </div>
      </div>
      {#if current.isPending || !view.ready}
        <div class="skeleton" style="height: 300px"></div>
      {:else if placeData.length}
        <Places data={placeData} />
      {:else}
        <p class="empty">No spending in {name}.</p>
      {/if}
    </section>
  </div>
  <div class="row bottom">
    <section class="panel col">
      <div class="head">
        <div>
          <h1>Income and spending</h1>
          <div class="small">last {months.length} months · click a month to open it</div>
        </div>
        <div class="kpis">
          <div><span class="small">Avg spent</span><b>{view.show(avgSpent, { decimals: 0 })}</b></div>
          <div><span class="small">Avg {avgSaved >= 0 ? "saved" : "lost"}</span><b class:pos={avgSaved > 0} class:neg={avgSaved < 0}>{view.show(Math.abs(avgSaved), { decimals: 0 })}</b></div>
        </div>
      </div>
      {#if loading}<div class="skeleton" style="flex: 1"></div>{:else}<FlowChart data={flowData} />{/if}
    </section>
    <section class="panel heat">
      <div class="head">
        <div>
          <h1>Every day</h1>
          <div class="small">last 6 months · brighter means more spent · click a day to see it</div>
        </div>
      </div>
      {#if loading}<div class="skeleton" style="height: 170px"></div>{:else}<Heat data={dayData} end={period.end} weeks={26} />{/if}
    </section>
  </div>
</div>

<style>
  .stats {
    display: grid;
    grid-template-rows: minmax(440px, 1fr) minmax(330px, auto);
    gap: 20px;
    height: calc(100dvh - 64px - 76px);
    min-height: 790px;
  }
  .panel {
    padding: 22px 24px;
  }
  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
  }
  h1 {
    font-size: 17px;
    font-weight: 800;
    margin-bottom: 3px;
  }
  .kpis {
    display: flex;
    gap: 32px;
  }
  .kpis div {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .kpis b {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .row {
    display: grid;
    gap: 20px;
    min-height: 0;
  }
  .top {
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  }
  .bottom {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .heat {
    min-width: 0;
  }
  .col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .empty {
    flex: 1;
    display: grid;
    place-items: center;
    color: var(--mute);
    font-weight: 600;
    min-height: 200px;
  }
  @media (max-width: 760px) {
    .stats {
      display: flex;
      flex-direction: column;
      height: auto;
      min-height: 0;
      gap: 14px;
    }
    .panel {
      padding: 18px;
    }
    .head {
      flex-direction: column;
      gap: 12px;
    }
    .kpis div {
      align-items: flex-start;
    }
    .row {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
    .col {
      height: 380px;
    }
    .top > .col:first-child {
      height: 440px;
    }
    .heat {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .heat :global(.cal) {
      min-width: 420px;
    }
  }
</style>
