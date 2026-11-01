<script lang="ts">
  import { look } from "../look.svelte.js";

  let { tag, href }: { tag: string; href?: string } = $props();
  const color = $derived(look.of("tag", tag, tag).color);
</script>

<svelte:element this={href ? "a" : "span"} class="tag" {href} style:--c={color}>
  <i></i>{tag}
</svelte:element>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border-radius: 7px;
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
    flex: none;
    color: color-mix(in srgb, var(--c) 78%, black);
    background: color-mix(in srgb, var(--c) 13%, transparent);
  }
  a.tag:hover {
    background: color-mix(in srgb, var(--c) 22%, transparent);
  }
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c);
  }
  :global(.dark) .tag {
    color: color-mix(in srgb, var(--c) 70%, white);
  }
</style>
