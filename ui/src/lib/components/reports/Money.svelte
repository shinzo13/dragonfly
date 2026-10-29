<script lang="ts">
  import {
    amountOf,
    currencies,
    type Side,
    type Totals,
  } from "#lib/reports/flows.js";
  import { money } from "#lib/reports/report.svelte.js";

  let {
    totals,
    side,
    codes,
    mode,
  }: {
    totals: Totals | undefined;
    side: Side;
    codes: string[];
    mode?: string;
  } = $props();

  const lines = $derived.by(() => {
    if (!totals) {
      return [];
    }
    const list = mode === "pc" ? ["pc"] : currencies(totals, codes);
    return list
      .map((code) => ({ code, value: amountOf(totals, code, side) }))
      .filter((line) => Math.abs(line.value) > 0.000_001);
  });

  function tone(value: number) {
    if (side === "out") {
      return "text-expense";
    }
    if (side === "in") {
      return "text-income";
    }
    return value < 0 ? "text-expense" : "text-income";
  }
</script>

{#each lines as line (line.code)}
  <div class="num {tone(line.value)}">
    {money(line.code, side === "out" ? -line.value : line.value)}
  </div>
{/each}
