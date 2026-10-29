<script lang="ts">
  import { compactMoney, formatNumber } from "#lib/format.js";
  import BarRows from "./BarRows.svelte";
  import Columns from "./Columns.svelte";
  import type { Bar, StackRow } from "./chart.js";

  let {
    bars,
    orientation = "vertical",
    color = "var(--ff-series-1)",
    name = "Amount",
    height = 240,
    format = (value: number) => formatNumber(value),
    axisFormat = (value: number) => compactMoney(value),
    label = "Bar chart",
    labelWidth,
    active = $bindable(null),
    onselect,
  }: {
    bars: Bar[];
    orientation?: "vertical" | "horizontal";
    color?: string;
    name?: string;
    height?: number;
    format?: (value: number) => string;
    axisFormat?: (value: number) => string;
    label?: string;
    labelWidth?: string;
    active?: string | null;
    onselect?: (bar: Bar) => void;
  } = $props();

  const keys = $derived([{ color, key: "value", label: name }]);
  const rows = $derived<StackRow[]>(
    bars.map((bar) => ({
      color: bar.color,
      format: bar.format,
      href: bar.href,
      key: bar.key,
      label: bar.label,
      note: bar.note,
      values: { value: bar.value },
    }))
  );
  const pick = $derived(
    onselect
      ? (row: StackRow) => {
          const bar = bars.find((b) => b.key === row.key);
          if (bar) {
            onselect(bar);
          }
        }
      : undefined
  );
</script>

{#if orientation === "horizontal"}
  <BarRows {format} {keys} {label} {labelWidth} onselect={pick} {rows} />
{:else}
  <Columns
    {axisFormat}
    {format}
    {height}
    {keys}
    {label}
    onselect={pick}
    {rows}
    bind:active
  />
{/if}
