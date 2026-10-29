<script lang="ts">
  import Money from "#lib/components/Money.svelte";
  import { formatMoney } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import type { Total } from "./object-groups.js";

  let {
    totals,
    tone = "plain",
    empty = "",
  }: {
    totals: Total[];
    tone?: "income" | "expense" | "plain";
    empty?: string;
  } = $props();

  const merged = $derived(display.total(totals) !== null);
</script>

{#if totals.length === 0}
  {#if empty}
    <span class="text-cladd-fg-softer">{empty}</span>
  {/if}
{:else if tone !== "plain"}
  <Money parts={totals} {tone} />
{:else if merged}
  <div><span class="num">{display.text(totals)}</span></div>
{:else}
  {#each totals as total (total.code)}
    <div><span class="num">{formatMoney(total)}</span></div>
  {/each}
{/if}
