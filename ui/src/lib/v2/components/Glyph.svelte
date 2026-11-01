<script lang="ts">
  import { glyphs } from "../glyphs.svelte.js";
  import { look } from "../look.svelte.js";

  let {
    name,
    size = 18,
    stroke = 2,
  }: { name: string; size?: number; stroke?: number } = $props();

  const svg = $derived(name.startsWith("svg:") ? look.svgUrl(name) : null);
  const node = $derived(svg ? null : glyphs.nodes[name] ?? glyphs.nodes.shapes);
</script>

{#if svg}
  <img alt="" height={size} src={svg} width={size} />
{:else if node}
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width={stroke}
    viewBox="0 0 24 24"
    width={size}
  >
    {#each node as [tag, attrs], i (i)}
      <svelte:element this={tag} {...attrs} />
    {/each}
  </svg>
{:else}
  <span style:width="{size}px" style:height="{size}px"></span>
{/if}

<style>
  img {
    object-fit: contain;
    display: block;
  }
  svg {
    display: block;
    flex: none;
  }
</style>
