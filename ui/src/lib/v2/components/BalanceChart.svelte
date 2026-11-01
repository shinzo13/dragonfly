<script lang="ts">
  import { num } from "../money.svelte.js";
  import { shortDate } from "../when.js";

  interface Point {
    date: string;
    value: number;
  }

  let {
    points,
    ghost = [],
    height = 300,
    format,
    axis = true,
    slots = 0,
  }: {
    points: Point[];
    ghost?: Point[];
    height?: number;
    format: (value: number) => string;
    axis?: boolean;
    slots?: number;
  } = $props();

  let width = $state(0);
  let hover = $state<number | null>(null);

  const AXIS = 56;
  const PAD = 10;
  const BOTTOM = 28;

  const plotW = $derived(Math.max(0, width - (axis ? AXIS : 0)));
  const plotH = $derived(height - BOTTOM);
  const count = $derived(Math.max(points.length, ghost.length, slots, 2));

  const range = $derived.by(() => {
    const all = [...points, ...ghost].map((p) => p.value);
    if (all.length === 0) {
      return { max: 1, min: 0 };
    }
    let min = Math.min(...all);
    let max = Math.max(...all);
    const span = max - min || Math.abs(max) || 1;
    min -= span * 0.08;
    max += span * 0.06;
    return { max, min };
  });

  const x = (i: number) => (i / (count - 1)) * plotW;
  const y = (v: number) => PAD + (1 - (v - range.min) / (range.max - range.min)) * (plotH - PAD * 2);

  const line = (list: Point[]) => list.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");

  const main = $derived(line(points));
  const area = $derived(points.length ? `${main} L${x(points.length - 1).toFixed(1)} ${plotH} L0 ${plotH}Z` : "");
  const shadow = $derived(line(ghost));
  const last = $derived(points.length ? points.length - 1 : null);
  const grid = $derived([0, 1, 2, 3].map((i) => range.max - (i * (range.max - range.min)) / 3));
  const ticks = $derived.by(() => {
    if (points.length < 2) {
      return [];
    }
    const step = Math.max(1, Math.round((points.length - 1) / 4));
    const out: number[] = [];
    for (let i = 0; i < points.length; i += step) {
      out.push(i);
    }
    return out;
  });

  const id = `g${Math.random().toString(36).slice(2, 8)}`;

  function move(event: PointerEvent) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const at = Math.round(((event.clientX - rect.left) / plotW) * (count - 1));
    hover = at >= 0 && at < points.length ? at : null;
  }

  const active = $derived(hover ?? last);
</script>

<div class="chart" bind:clientWidth={width} style:height="{height}px">
  {#if width > 0}
    <svg {height} role="img" aria-label="Balance over the period" {width} onpointerleave={() => (hover = null)} onpointermove={move}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--acc)" stop-opacity="0.18" />
          <stop offset="1" stop-color="var(--acc)" stop-opacity="0" />
        </linearGradient>
      </defs>
      {#each grid as value, i (i)}
        {@const gy = PAD + (i * (plotH - PAD * 2)) / 3}
        <line stroke="var(--track)" x1="0" x2={plotW} y1={gy} y2={gy} />
        {#if axis}<text fill="var(--faint)" font-size="11.5" font-weight="600" x={plotW + 10} y={gy + 4}>{num(value, 0)}</text>{/if}
      {/each}
      {#if ghost.length}
        <path d={shadow} fill="none" stroke="var(--faint)" stroke-dasharray="4 4" stroke-opacity="0.55" stroke-width="1.5" />
      {/if}
      <path d={area} fill="url(#{id})" />
      <path d={main} fill="none" stroke="var(--acc)" stroke-linejoin="round" stroke-width="2.5" />
      {#if active !== null && points[active]}
        {@const px = x(active)}
        {@const py = y(points[active].value)}
        <line stroke="var(--acc)" stroke-dasharray="2 3" x1={px} x2={px} y1={py} y2={plotH} />
        <circle cx={px} cy={py} fill="var(--panel)" r="5" stroke="var(--acc)" stroke-width="2.5" />
      {/if}
      {#each ticks as i (i)}
        <text fill="var(--faint)" font-size="12" font-weight="600" text-anchor={i === 0 ? "start" : "middle"} x={x(i)} y={height - 6}>{shortDate(points[i].date)}</text>
      {/each}
    </svg>
    {#if hover !== null && points[hover]}
      {@const left = Math.min(Math.max(x(hover), 70), plotW - 70)}
      <div class="tip" style:left="{left}px">
        <span class="small">{shortDate(points[hover].date)}</span>
        <b>{format(points[hover].value)}</b>
        {#if ghost[hover]}<span class="small">was {format(ghost[hover].value)}</span>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart {
    position: relative;
    width: 100%;
  }
  svg {
    display: block;
    overflow: visible;
    cursor: crosshair;
  }
  .tip {
    position: absolute;
    top: -6px;
    transform: translateX(-50%);
    background: var(--panel);
    box-shadow: var(--pop);
    border-radius: 10px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    pointer-events: none;
    white-space: nowrap;
    font-size: 14px;
  }
</style>
