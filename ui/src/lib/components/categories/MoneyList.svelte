<script lang="ts">
  import Amount, { type Tone } from "#lib/components/Amount.svelte";
  import Money from "#lib/components/Money.svelte";
  import { display } from "#lib/money/display.svelte.js";
  import type { Sum } from "./sums.js";

  let {
    sums,
    tone = "auto",
    empty = "",
    class: className = "",
  }: { sums: Sum[]; tone?: Tone; empty?: string; class?: string } = $props();

  const merged = $derived(display.total(sums) !== null);
</script>

{#if sums.length === 0}
  {#if empty}
    <span class="num text-cladd-fg-softer {className}">{empty}</span>
  {/if}
{:else}
  <span class="inline-flex flex-wrap justify-end gap-x-2.5 {className}">
    {#if merged}
      <Money parts={sums} {tone} />
    {:else}
      {#each sums as sum (sum.code)}
        <Amount
          amount={sum.amount}
          code={sum.code}
          decimals={sum.decimals}
          symbol={sum.symbol}
          {tone}
        />
      {/each}
    {/if}
  </span>
{/if}
