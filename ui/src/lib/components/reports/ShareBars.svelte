<script lang="ts">
  import { percent } from "#lib/format.js";
  import {
    amountOf,
    type Dimension,
    type Row,
    rank,
  } from "#lib/reports/flows.js";
  import {
    drillQuery,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";

  let {
    box,
    rows,
    side,
    dim,
    limit = 8,
  }: {
    box: string;
    rows: Row[];
    side: "in" | "out";
    dim: Dimension;
    limit?: number;
  } = $props();

  const report = useReport();
  const mode = $derived(report.mode);
  const dir = $derived(side === "in" ? 1 : -1);

  const ranked = $derived(
    rank(rows, mode, side)
      .map((row) => ({ row, value: amountOf(row.totals, mode, side) }))
      .filter((item) => item.value > 0)
  );
  const head = $derived(ranked.slice(0, limit));
  const rest = $derived(ranked.slice(limit));
  const restValue = $derived(rest.reduce((acc, item) => acc + item.value, 0));
  const sum = $derived(ranked.reduce((acc, item) => acc + item.value, 0));
  const max = $derived(
    Math.max(restValue, ...head.map((item) => item.value), 1)
  );
  const color = $derived(
    side === "in" ? "var(--ff-income)" : "var(--ff-expense)"
  );

  function open(row: Row) {
    const current = report.drill;
    const same =
      current?.box === box && current.key === row.key && current.dim === dim;
    navigate(
      drillQuery(
        same ? null : { box, dim, dir, key: row.key, label: row.label }
      )
    );
  }
</script>

{#snippet line(
  label: string,
  value: number,
  fill: string
)}
  <span class="flex w-full items-baseline gap-3">
    <span class="min-w-0 flex-1 truncate">{label}</span>
    <span class="num">{money(mode, value)}</span>
    <span class="num w-9 text-right text-cladd-fg-soft"
      >{percent(value / sum)}</span
    >
  </span>
  <span class="block h-1.5 w-full rounded-full bg-cladd-surface-next">
    <span
      class="block h-full rounded-full"
      style:background={fill}
      style:width="{(value / max) * 100}%"
    ></span>
  </span>
{/snippet}

{#if ranked.length === 0}
  <p class="px-3 py-3 text-cladd-fg-soft">
    Nothing in {mode === "pc" ? "this period" : mode}.
  </p>
{:else}
  <ul class="flex flex-col py-1.5">
    {#each head as item (item.row.key)}
      {@const active =
        report.drill?.box === box && report.drill.key === item.row.key}
      <li>
        <button
          aria-pressed={active}
          class="flex w-full flex-col gap-1 px-3 py-1 text-left hover:bg-row-hover {active
            ? "bg-row-selected"
            : ""}"
          onclick={() => open(item.row)}
          title="Show transactions for {item.row.label}"
          type="button"
        >
          {@render line(item.row.label, item.value, color)}
        </button>
      </li>
    {/each}
    {#if rest.length > 0}
      <li class="flex flex-col gap-1 px-3 py-1 text-cladd-fg-soft">
        {@render line(
          `Other (${rest.length})`,
          restValue,
          "var(--cladd-fg-softest)"
        )}
      </li>
    {/if}
  </ul>
{/if}
