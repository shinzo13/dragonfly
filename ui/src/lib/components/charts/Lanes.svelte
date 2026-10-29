<script lang="ts">
  import { scaleLinear } from "d3-scale";
  import type { Snippet } from "svelte";
  import { compactMoney } from "#lib/format.js";
  import { versus, versusText } from "#lib/reports/typical.js";
  import Columns from "./Columns.svelte";
  import {
    type Lane,
    type StackKey,
    type StackRow,
    stack,
    textWidth,
    tones,
  } from "./chart.js";
  import Legend from "./Legend.svelte";

  const LANE_HEIGHT = 112;
  const AXIS_HEIGHT = 18;
  const TICK_GAP = 44;

  let {
    lanes,
    cursor = null,
    hover = $bindable(null),
    partial = null,
    pinned = false,
    dotLabel = "in",
    dotColor = tones.income,
    title = (row: StackRow) => row.label,
    label = "Months by currency",
    legend = true,
    moreIsGood = false,
    header,
    onselect,
  }: {
    lanes: Lane[];
    cursor?: string | null;
    hover?: string | null;
    partial?: string | null;
    pinned?: boolean;
    dotLabel?: string;
    moreIsGood?: boolean;
    dotColor?: string;
    title?: (row: StackRow) => string;
    label?: string;
    legend?: boolean;
    header?: Snippet<[Lane, StackRow | undefined]>;
    onselect?: (month: string, lane: Lane, segment?: string) => void;
  } = $props();

  const read = $derived(pinned ? cursor : (hover ?? cursor));

  const sharedKeys = $derived.by(() => {
    const seen = new Map<string, StackKey>();
    for (const lane of lanes) {
      for (const key of lane.keys) {
        if (!seen.has(key.key)) {
          seen.set(key.key, key);
        }
      }
    }
    return [...seen.values()];
  });

  function widest(lane: Lane) {
    const stacks = lane.rows.map((row) => stack(row, lane.keys));
    const top = Math.max(
      lane.typical ?? 0,
      ...stacks.map((s) => s.positive),
      ...Object.values(lane.dots ?? {})
    );
    const bottom = Math.min(0, ...stacks.map((s) => s.negative));
    const height = lane.height ?? LANE_HEIGHT;
    const count = Math.max(2, Math.floor((height - 60) / TICK_GAP));
    const format = lane.axisFormat ?? ((v: number) => compactMoney(v));
    const ticks = scaleLinear()
      .domain([bottom, top || 1])
      .nice(count)
      .ticks(count);
    return Math.max(...ticks.map((t) => textWidth(format(t))));
  }

  const gutter = $derived(
    Math.ceil(Math.max(24, ...lanes.map((lane) => widest(lane)))) + 10
  );

  function rowOf(lane: Lane) {
    return lane.rows.find((row) => row.key === read);
  }

  function totalOf(row: StackRow | undefined) {
    return row ? Object.values(row.values).reduce((a, b) => a + b, 0) : 0;
  }

  function tone(ratio: number | null) {
    if (ratio === null || Math.abs(ratio) < 0.03) {
      return "text-cladd-fg-soft";
    }
    return ratio > 0 === moreIsGood ? "text-income" : "text-expense";
  }
</script>

{#snippet defaultHeader(
  lane: Lane,
  row: StackRow | undefined
)}
  {@const value = totalOf(row)}
  {@const sofar = row?.key === partial}
  {@const ratio =
    row && lane.typical && !sofar ? versus(value, lane.typical) : null}
  {@const dot = row ? lane.dots?.[row.key] : undefined}
  <span class="w-10 shrink-0 font-semibold text-cladd-fg">{lane.label}</span>
  {#if row}
    <span class="text-cladd-fg-soft">{title(row)}</span>
    <span class="num font-semibold text-cladd-fg">{lane.format(value)}</span>
    {#if sofar}
      <span class="text-cladd-fg-soft">so far</span>
    {:else if ratio !== null}
      <span class={tone(ratio)}>{versusText(ratio)}</span>
    {/if}
  {/if}
  {#if lane.typical}
    <span class="flex items-center gap-1.5 text-cladd-fg-soft">
      <span
        aria-hidden="true"
        class="w-3 border-cladd-fg-soft border-t-[1.5px] border-dotted"
      ></span>
      typical
      <span class="num">{lane.format(lane.typical)}</span>
    </span>
  {/if}
  {#if dot}
    <span class="flex items-center gap-1.5 text-cladd-fg-soft">
      <span
        aria-hidden="true"
        class="size-2 rounded-full"
        style:background={dotColor}
      ></span>
      {dotLabel}
      <span class="num text-cladd-fg">{lane.format(dot)}</span>
    </span>
  {/if}
{/snippet}

<figure aria-label={label} class="m-0 flex min-w-0 flex-col">
  {#if legend && sharedKeys.length > 1}
    <Legend
      class="mb-2"
      items={sharedKeys.map((k) => ({ ...k, shape: "rect" as const }))}
    />
  {/if}
  {#each lanes as lane, i (lane.key)}
    {@const last = i === lanes.length - 1}
    <div class="min-w-0 {i > 0 ? "border-cladd-outline border-t pt-1.5" : ""}">
      <div
        class="flex min-h-6 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]"
      >
        {@render (header ?? defaultHeader)(lane, rowOf(lane))}
      </div>
      <Columns
        axis={last}
        axisFormat={lane.axisFormat}
        {dotColor}
        dots={lane.dots}
        format={lane.format}
        {gutter}
        height={(lane.height ?? LANE_HEIGHT) + (last ? AXIS_HEIGHT : 0)}
        keyboard={false}
        keys={lane.keys}
        label="{label}: {lane.label}"
        legend={false}
        onselect={onselect
          ? (row, segment) => onselect(row.key, lane, segment)
          : undefined}
        {partial}
        reference={lane.typical}
        rows={lane.rows}
        selected={cursor}
        tilt={false}
        bind:active={hover}
      />
    </div>
  {/each}
</figure>
