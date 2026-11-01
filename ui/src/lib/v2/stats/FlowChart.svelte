<script lang="ts">
  import { period } from "#lib/period.svelte.js";
  import { num, view } from "../money.svelte.js";
  import { type Month, niceTicks } from "./model.js";

  let { data }: { data: { month: Month; earned: number; spent: number }[] } = $props();

  let width = $state(0);
  let hover = $state<number | null>(null);
  let H = $state(300);
  const AXIS = 52;
  const BOTTOM = 28;
  const TOP = 12;

  const plotW = $derived(Math.max(0, width - AXIS));
  const max = $derived(Math.max(1, ...data.flatMap((d) => [d.earned, d.spent])));
  const minNet = $derived(Math.min(0, ...data.map((d) => d.earned - d.spent)));
  const ticks = $derived(niceTicks(minNet, max));
  const lo = $derived(ticks[0]);
  const hi = $derived(ticks[ticks.length - 1]);
  const y = (v: number) => TOP + (1 - (v - lo) / (hi - lo)) * (H - BOTTOM - TOP);
  const col = $derived(plotW / Math.max(1, data.length));
  const bar = $derived(Math.min(22, col * 0.28));
  const net = $derived(
    data.map((d, i) => `${i ? "L" : "M"}${(i + 0.5) * col} ${y(d.earned - d.spent)}`).join(" ")
  );
  const current = $derived(period.start.slice(0, 7));
</script>

<div class="wrap" bind:clientHeight={H} bind:clientWidth={width}>
  {#if width}
    <svg height={H} {width} onpointerleave={() => (hover = null)} role="img" aria-label="Income and spending by month">
      {#each ticks as t (t)}
        <line stroke="var(--track)" x1="0" x2={plotW} y1={y(t)} y2={y(t)} />
        <text fill="var(--faint)" font-size="11.5" font-weight="600" x={plotW + 10} y={y(t) + 4}>{t < 0 ? "−" : ""}{num(t, 0)}</text>
      {/each}
      <line stroke="var(--line)" stroke-width="1.5" x1="0" x2={plotW} y1={y(0)} y2={y(0)} />
      {#each data as d, i (d.month.key)}
        {@const cx = (i + 0.5) * col}
        <g class="col" class:dim={hover !== null && hover !== i} onclick={() => period.set({ end: d.month.end, start: d.month.start })} onkeydown={() => undefined} onpointerenter={() => (hover = i)} role="button" tabindex="-1">
          <rect fill="transparent" height={H} width={col} x={i * col} y="0" />
          {#if d.month.key === current}
            <rect class="now" height={H - BOTTOM} rx="10" width={col - 6} x={i * col + 3} y="0" />
          {/if}
          <rect fill="var(--pos)" height={Math.max(0, y(0) - y(d.earned))} rx="4" width={bar} x={cx - bar - 2} y={y(d.earned)} />
          <rect fill="var(--neg)" height={Math.max(0, y(0) - y(d.spent))} opacity="0.85" rx="4" width={bar} x={cx + 2} y={y(d.spent)} />
          <text fill={d.month.key === current ? "var(--ink)" : "var(--faint)"} font-size="12" font-weight="700" text-anchor="middle" x={cx} y={H - 8}>{d.month.label}</text>
        </g>
      {/each}
      <path d={net} fill="none" pointer-events="none" stroke="var(--acc)" stroke-linejoin="round" stroke-width="2.5" />
      {#each data as d, i (d.month.key)}
        <circle cx={(i + 0.5) * col} cy={y(d.earned - d.spent)} fill="var(--panel)" pointer-events="none" r="4" stroke="var(--acc)" stroke-width="2.5" />
      {/each}
    </svg>
    {#if hover !== null}
      {@const d = data[hover]}
      <div class="tip" style:left="{Math.min(Math.max((hover + 0.5) * col, 90), plotW - 90)}px">
        <b>{d.month.label} {d.month.key.slice(0, 4)}</b>
        <span><i style:background="var(--pos)"></i>Earned <b>{view.show(d.earned, { decimals: 0 })}</b></span>
        <span><i style:background="var(--neg)"></i>Spent <b>{view.show(d.spent, { decimals: 0 })}</b></span>
        <span><i style:background="var(--acc)"></i>{d.earned >= d.spent ? "Saved" : "Ate into savings"} <b>{view.show(Math.abs(d.earned - d.spent), { decimals: 0 })}</b></span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    flex: 1;
    min-height: 240px;
  }
  svg {
    position: absolute;
    inset: 0;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .col {
    cursor: pointer;
    outline: none;
    transition: opacity 0.15s;
  }
  .col.dim {
    opacity: 0.45;
  }
  .now {
    fill: var(--sunk);
  }
  .tip {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    background: var(--panel);
    box-shadow: var(--pop);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    font-weight: 600;
    pointer-events: none;
    white-space: nowrap;
    z-index: 2;
  }
  .tip span {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--mute);
  }
  .tip span b {
    margin-left: auto;
    padding-left: 12px;
    color: var(--ink);
  }
  .tip i {
    width: 8px;
    height: 8px;
    border-radius: 3px;
  }
</style>
