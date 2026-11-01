<script lang="ts">
  import Glyph from "./Glyph.svelte";

  let {
    icon,
    color,
    size = 36,
    radius,
  }: { icon: string; color: string; size?: number; radius?: number } = $props();

  const custom = $derived(icon.startsWith("svg:"));
</script>

<span
  class="chip"
  class:custom
  style:width="{size}px"
  style:height="{size}px"
  style:border-radius="{radius ?? Math.round(size * 0.3)}px"
  style:background={custom ? "#fff" : color}
>
  <Glyph name={icon} size={Math.round(size * (custom ? 0.62 : 0.48))} stroke={2.2} />
</span>

<style>
  .chip {
    display: grid;
    place-items: center;
    color: #fff;
    flex: none;
  }
  :global(.dark) .chip:not(.custom) {
    box-shadow: inset 0 0 0 1px #ffffff12;
  }
  .custom {
    box-shadow: inset 0 0 0 1px #0000001a;
  }
</style>
