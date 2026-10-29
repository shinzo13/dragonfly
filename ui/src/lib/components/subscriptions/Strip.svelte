<script lang="ts">
  import type { Cell } from "./bills.js";

  let { cells, months }: { cells: Cell[]; months: string[] } = $props();

  const LOOK: Record<Cell, string> = {
    due: "border border-warn",
    idle: "border border-cladd-fg-softest",
    missed: "border border-expense bg-expense/15",
    off: "bg-cladd-fg-softest/25 scale-50",
    paid: "bg-income",
  };

  const TITLE: Record<Cell, string> = {
    due: "expected, not paid yet",
    idle: "expected",
    missed: "expected, not paid",
    off: "not expected",
    paid: "paid",
  };
</script>

<span class="inline-flex gap-[3px] align-middle">
  {#each cells as cell, i (months[i])}
    <span
      class="size-2.5 rounded-[2px] {LOOK[cell]}"
      title="{months[i]}: {TITLE[cell]}"
    ></span>
  {/each}
</span>
