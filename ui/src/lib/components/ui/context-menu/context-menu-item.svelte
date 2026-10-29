<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    variant = "default",
    ...restProps
  }: ContextMenuPrimitive.ItemProps & {
    inset?: boolean;
    variant?: "default" | "destructive";
  } = $props();
</script>

<ContextMenuPrimitive.Item
  bind:ref
  data-slot="context-menu-item"
  data-inset={inset}
  data-variant={variant}
  class={cn(
    "data-[variant=destructive]:*:[svg]:!text-destructive relative flex min-h-cladd-lg cursor-default select-none items-center gap-2 rounded-full px-3 py-1 font-medium text-cladd-xs outline-hidden transition-[background-color,box-shadow] duration-200 data-[variant=destructive]:data-highlighted:bg-destructive/12 data-[disabled]:pointer-events-none data-highlighted:bg-cladd-surface-next data-[inset]:ps-8 data-[inset]:ps-9 data-[variant=destructive]:text-destructive data-[disabled]:opacity-40 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-cladd-fg-soft [&_svg]:pointer-events-none [&_svg]:shrink-0",
    className
  )}
  {...restProps}
/>
