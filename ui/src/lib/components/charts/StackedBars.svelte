<script lang="ts">
  import { compactMoney, formatNumber } from "#lib/format.js";
  import BarRows from "./BarRows.svelte";
  import Columns from "./Columns.svelte";
  import type { StackKey, StackRow } from "./chart.js";
  import Legend from "./Legend.svelte";

  let {
    keys,
    rows,
    orientation = "vertical",
    height = 240,
    format = (value: number) => formatNumber(value),
    axisFormat = (value: number) => compactMoney(value),
    label = "Stacked bar chart",
    labelWidth,
    active = $bindable(null),
    onselect,
  }: {
    keys: StackKey[];
    rows: StackRow[];
    orientation?: "vertical" | "horizontal";
    height?: number;
    format?: (value: number) => string;
    axisFormat?: (value: number) => string;
    label?: string;
    labelWidth?: string;
    active?: string | null;
    onselect?: (row: StackRow) => void;
  } = $props();
</script>

{#if orientation === "horizontal"}
  <div class="flex min-w-0 flex-col gap-2">
    {#if keys.length > 1}
      <Legend items={keys.map((k) => ({ ...k, shape: "rect" as const }))} />
    {/if}
    <BarRows {format} {keys} {label} {labelWidth} {onselect} {rows} />
  </div>
{:else}
  <Columns
    {axisFormat}
    {format}
    {height}
    {keys}
    {label}
    {onselect}
    {rows}
    bind:active
  />
{/if}
