<script lang="ts">
  import { fmt, type StripCell } from "#lib/dimension/stats.js";
  import { longMonth, shortMonth } from "#lib/reports/board.js";

  let {
    strips,
    budgetId,
    cursor,
  }: {
    strips: Map<string, StripCell[]>;
    budgetId: string;
    cursor: string | null;
  } = $props();
</script>

{#snippet meter(
  cell: StripCell,
  code: string
)}
  {@const over = cell.spent > cell.amount}
  <span
    class="text-[11px] max-sm:hidden {cell.month === cursor
      ? "font-semibold text-cladd-fg"
      : "text-cladd-fg-soft"}"
    >{shortMonth(cell.month)}</span
  >
  <span class="relative h-1 w-full rounded-full bg-cladd-surface-next">
    {#if cell.id}
      <span
        class="absolute inset-y-0 left-0 rounded-full {over
          ? "bg-expense"
          : "bg-brand"}"
        style:width="{Math.min(1, cell.spent / (cell.amount || 1)) * 100}%"
      ></span>
    {/if}
  </span>
  <span class="sr-only"
    >{cell.id
      ? `${fmt(code, cell.spent, 0)} of ${fmt(code, cell.amount, 0)}`
      : "no limit"}</span
  >
{/snippet}

{#each [...strips] as [code, cells] (code)}
  <nav
    aria-label="Limits in {code}"
    class="mt-2 grid gap-1 border-cladd-outline border-t pt-2"
    style:grid-template-columns="2.5rem repeat({cells.length}, minmax(0, 1fr))"
  >
    <span class="self-center font-semibold text-[12px] text-cladd-fg"
      >{code}</span
    >
    {#each cells as cell (cell.month)}
      {#if cell.id}
        <a
          class="flex flex-col items-center gap-1 rounded-cladd-sm px-1 py-0.5 hover:bg-row-hover {cell.month ===
          cursor
            ? "bg-row-cursor"
            : ""}"
          href="/budgets/show/{budgetId}/{cell.id}"
          title="{longMonth(cell.month)}: {fmt(code, cell.spent, 0)} of {fmt(
            code,
            cell.amount,
            0
          )}"
        >
          {@render meter(cell, code)}
        </a>
      {:else}
        <span class="flex flex-col items-center gap-1 px-1 py-0.5">
          {@render meter(cell, code)}
        </span>
      {/if}
    {/each}
  </nav>
{/each}
