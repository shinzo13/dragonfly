<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn, type WithoutChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    value,
    label,
    children: childrenProp,
    ...restProps
  }: WithoutChild<SelectPrimitive.ItemProps> = $props();
</script>

<SelectPrimitive.Item
  bind:ref
  {value}
  data-slot="select-item"
  class={cn(
    "relative flex min-h-cladd-lg cursor-default select-none items-center gap-2 rounded-full py-1 ps-3 pe-9 font-medium text-cladd-xs outline-hidden transition-[background-color,box-shadow] duration-200 data-[disabled]:pointer-events-none data-[selected]:bg-cladd-surface-next data-highlighted:bg-cladd-surface-next data-[disabled]:opacity-40 data-[selected]:shadow-cladd-outline [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-cladd-fg-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
    className
  )}
  {...restProps}
>
  {#snippet children({
    selected,
    highlighted,
  })}
    <span class="absolute end-3 flex size-4 items-center justify-center">
      {#if selected}
        <CheckIcon class="size-4 text-cladd-fg" />
      {/if}
    </span>
    {#if childrenProp}
      {@render childrenProp({ selected, highlighted })}
    {:else}
      {label || value}
    {/if}
  {/snippet}
</SelectPrimitive.Item>
