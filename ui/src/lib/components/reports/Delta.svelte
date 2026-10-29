<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import { percent } from "#lib/format.js";

  let {
    now,
    before,
    upIsGood,
    title,
  }: {
    now: number;
    before: number | undefined;
    upIsGood: boolean;
    title?: string;
  } = $props();

  const ratio = $derived(
    before ? (Math.abs(now) - Math.abs(before)) / Math.abs(before) : null
  );
  const up = $derived((ratio ?? 0) > 0);
  const tone = $derived(up === upIsGood ? "text-income" : "text-expense");
</script>

{#if ratio !== null && Math.abs(ratio) >= 0.005}
  <span class="num inline-flex items-center gap-0.5 text-[11px] {tone}" {title}>
    {#if up}
      <ArrowUp aria-label="up" class="size-3" />
    {:else}
      <ArrowDown aria-label="down" class="size-3" />
    {/if}
    {percent(Math.abs(ratio))}
  </span>
{/if}
