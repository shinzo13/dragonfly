<script lang="ts">
  import { look } from "../look.svelte.js";
  import { view } from "../money.svelte.js";
  import { squarify } from "./model.js";

  let { data }: { data: { tag: string; value: number }[] } = $props();

  let width = $state(0);
  let height = $state(0);
  const GAP = 4;
  const TAIL = 0.015;
  const REST = "\u0000rest";
  const CYRILLIC = /\p{Script=Cyrillic}/u;

  const total = $derived(data.reduce((s, d) => s + d.value, 0));
  const shown = $derived(data.filter((d) => d.value >= total * TAIL));
  const rest = $derived(data.filter((d) => d.value < total * TAIL));
  const items = $derived(
    rest.length > 1 ? [...shown, { tag: REST, value: rest.reduce((s, d) => s + d.value, 0) }] : data
  );
  const boxes = $derived(width && height ? squarify(items, { h: height + GAP, w: width + GAP, x: 0, y: 0 }) : []);
</script>

<div class="map" bind:clientHeight={height} bind:clientWidth={width}>
  {#each boxes as b (b.tag)}
    {@const other = b.tag === REST}
    {@const label = other ? `+${rest.length} more` : b.tag}
    {@const pct = Math.round((b.value / total) * 100)}
    {@const named = b.w > 40 && b.h > 26}
    {@const sum = b.w > 74 && b.h > 64}
    {@const big = b.w > 120 && b.h > 110}
    <a
      class="cell"
      class:other
      class:tight={b.w < 90 || b.h < 60}
      href={other ? "/tx?type=withdrawal" : `/tx?tag=${encodeURIComponent(b.tag)}`}
      style:background={other ? null : look.of("tag", b.tag, b.tag).color}
      style:height="{b.h - GAP}px"
      style:left="{b.x}px"
      style:top="{b.y}px"
      style:width="{b.w - GAP}px"
      title={other ? rest.map((d) => `${d.tag} · ${view.show(d.value, { decimals: 0 })}`).join("\n") : `${b.tag} · ${view.show(b.value)} · ${pct}%`}
    >
      {#if named}<span class="name" class:big lang={CYRILLIC.test(label) ? "ru" : "en"}>{label}</span>{/if}
      {#if sum}<span class="sum" class:big>{view.show(b.value, { decimals: 0 })}</span>{/if}
      {#if big}<span class="pct">{pct}%</span>{/if}
    </a>
  {/each}
</div>

<style>
  .map {
    position: relative;
    flex: 1;
    min-height: 220px;
  }
  .cell {
    position: absolute;
    border-radius: 12px;
    color: #fff;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: filter 0.15s, transform 0.15s;
  }
  .cell:hover {
    filter: brightness(1.1);
  }
  .tight {
    padding: 6px 8px;
  }
  .tight .name {
    font-size: 11.5px;
  }
  .other {
    background: color-mix(in srgb, var(--ink) 22%, var(--sunk));
  }
  .name {
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.2;
    overflow: hidden;
    overflow-wrap: break-word;
    hyphens: auto;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .name.big {
    font-size: 14px;
  }
  .sum {
    margin-top: auto;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .sum.big {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .pct {
    font-size: 12px;
    font-weight: 700;
    opacity: 0.8;
  }
</style>
