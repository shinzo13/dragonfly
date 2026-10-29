<script lang="ts">
  import type { Money } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import Amount, { type Tone } from "./Amount.svelte";

  let {
    parts,
    tone = "auto",
    signed = false,
    inline = false,
    class: className = "",
  }: {
    parts: Money[];
    tone?: Tone;
    signed?: boolean;
    inline?: boolean;
    class?: string;
  } = $props();

  const total = $derived(display.total(parts));
</script>

{#if total}
  <Amount
    amount={total.amount}
    approx={total.converted}
    class={className}
    code={total.code}
    decimals={total.decimals}
    {signed}
    symbol={total.symbol}
    {tone}
  />
{:else if inline}
  {#each parts as part, index (part.code ?? index)}
    {#if index > 0}
      <span class="mx-1 text-cladd-fg-softer">+</span>
    {/if}
    <Amount {...part} class={className} {signed} {tone} />
  {/each}
{:else}
  {#each parts as part, index (part.code ?? index)}
    <div><Amount {...part} class={className} {signed} {tone} /></div>
  {/each}
{/if}
