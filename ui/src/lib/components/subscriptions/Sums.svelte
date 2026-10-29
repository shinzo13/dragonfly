<script lang="ts">
  import type { Money as Part } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import Money from "./Money.svelte";

  let { parts, inline = false }: { parts: Part[]; inline?: boolean } = $props();

  const total = $derived(display.total(parts));
</script>

{#if total}
  <Money {...total} converted={total.converted} />
{:else if inline}
  {#each parts as part, i (part.code ?? i)}
    {i > 0 ? " + " : ""}<Money {...part} />
  {/each}
{:else}
  {#each parts as part, i (part.code ?? i)}
    <div><Money {...part} /></div>
  {/each}
{/if}
