<script lang="ts">
  let {
    value,
    max,
    tick = null,
    class: className = "",
  }: {
    value: number;
    max: number;
    tick?: number | null;
    class?: string;
  } = $props();

  const ratio = $derived(max > 0 ? value / max : 0);
  const over = $derived(ratio > 1);
  const fill = $derived(over ? 1 / ratio : Math.min(1, ratio));
  const ahead = $derived(tick !== null && !over && ratio > tick);
</script>

<div
  aria-hidden="true"
  class="relative h-2 overflow-hidden rounded-full bg-cladd-surface-next {className}"
>
  <div
    class="absolute inset-y-0 left-0 rounded-full {over || ahead
      ? "bg-warn"
      : "bg-brand"}"
    style:width="{fill * 100}%"
  ></div>
  {#if over}
    <div
      class="absolute inset-y-0 right-0 bg-expense"
      style:left="{fill * 100}%"
    ></div>
  {/if}
  {#if tick !== null}
    <div
      class="absolute -inset-y-px w-0.5 bg-cladd-fg"
      style:left="calc({Math.min(1, tick) * 100}% - 1px)"
    ></div>
  {/if}
</div>
