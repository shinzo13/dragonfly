<script lang="ts">
  import type { LegendItem } from "./chart.js";

  let {
    items,
    ontoggle,
    widths = {},
    class: className = "",
  }: {
    items: LegendItem[];
    ontoggle?: (key: string) => void;
    widths?: Record<string, number>;
    class?: string;
  } = $props();
</script>

{#snippet content(
  item: LegendItem
)}
  <span
    aria-hidden="true"
    class="shrink-0 {item.shape === "rect"
      ? "size-2.5 rounded-[3px]"
      : "h-0.5 w-3 rounded-full"}"
    style:background={item.color}
  ></span>
  {#if item.value !== undefined}
    <span
      class="num font-semibold text-cladd-fg"
      style:min-width={widths[item.key] ? `${widths[item.key]}ch` : undefined}
      >{item.value}</span
    >
  {/if}
  <span class="truncate text-cladd-fg-soft">{item.label}</span>
{/snippet}

<ul class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] {className}">
  {#each items as item (item.key)}
    <li class="min-w-0 max-w-full">
      {#if ontoggle}
        <button
          aria-pressed={!item.hidden}
          class="flex min-w-0 max-w-full items-center gap-1.5 rounded-sm hover:text-cladd-fg {item.hidden
            ? "opacity-40"
            : ""}"
          onclick={() => ontoggle(item.key)}
          title={item.hidden ? `Show ${item.label}` : `Hide ${item.label}`}
          type="button"
        >
          {@render content(item)}
        </button>
      {:else}
        <span class="flex min-w-0 items-center gap-1.5"
          >{@render content(item)}</span
        >
      {/if}
    </li>
  {/each}
</ul>
