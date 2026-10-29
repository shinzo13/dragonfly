<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import { cn, type WithoutChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children: childrenProp,
    ...restProps
  }: WithoutChild<ContextMenuPrimitive.RadioItemProps> = $props();
</script>

<ContextMenuPrimitive.RadioItem
  bind:ref
  data-slot="context-menu-radio-item"
  class={cn(
    "relative flex min-h-cladd-lg cursor-default select-none items-center gap-2 rounded-full py-1 ps-9 pe-3 font-medium text-cladd-xs outline-hidden transition-[background-color,box-shadow] duration-200 data-[disabled]:pointer-events-none data-highlighted:bg-cladd-surface-next data-[disabled]:opacity-40 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-cladd-fg-soft [&_svg]:pointer-events-none [&_svg]:shrink-0",
    className
  )}
  {...restProps}
>
  {#snippet children({
    checked,
  })}
    <span
      class="pointer-events-none absolute start-3 flex size-4 items-center justify-center"
    >
      {#if checked}
        <CircleIcon class="size-2 fill-current" />
      {/if}
    </span>
    {@render childrenProp?.({ checked })}
  {/snippet}
</ContextMenuPrimitive.RadioItem>
