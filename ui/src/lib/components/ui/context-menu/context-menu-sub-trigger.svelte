<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { cn, type WithoutChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    children,
    ...restProps
  }: WithoutChild<ContextMenuPrimitive.SubTriggerProps> & {
    inset?: boolean;
  } = $props();
</script>

<ContextMenuPrimitive.SubTrigger
  bind:ref
  data-slot="context-menu-sub-trigger"
  data-inset={inset}
  class={cn(
    "relative flex min-h-cladd-lg cursor-default select-none items-center gap-2 rounded-full px-3 py-1 font-medium text-cladd-xs outline-hidden transition-[background-color,box-shadow] duration-200 data-[disabled]:pointer-events-none data-[state=open]:bg-cladd-surface-next data-highlighted:bg-cladd-surface-next data-[inset]:ps-8 data-[inset]:ps-9 data-[disabled]:opacity-40 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-cladd-fg-soft [&_svg]:pointer-events-none [&_svg]:shrink-0",
    className
  )}
  {...restProps}
>
  {@render children?.()}
  <ChevronRightIcon class="ms-auto" />
</ContextMenuPrimitive.SubTrigger>
