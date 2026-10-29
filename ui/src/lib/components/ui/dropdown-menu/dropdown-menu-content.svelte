<script lang="ts">
  import { cn, type WithoutChildrenOrChild } from "#lib/utils.js";
  import DropdownMenuPortal from "./dropdown-menu-portal.svelte";
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import type { ComponentProps } from "svelte";

  let {
    ref = $bindable(null),
    sideOffset = 4,
    portalProps,
    class: className,
    ...restProps
  }: DropdownMenuPrimitive.ContentProps & {
    portalProps?: WithoutChildrenOrChild<
      ComponentProps<typeof DropdownMenuPortal>
    >;
  } = $props();
</script>

<DropdownMenuPortal {...portalProps}>
  <DropdownMenuPrimitive.Content
    bind:ref
    data-slot="dropdown-menu-content"
    {sideOffset}
    class={cn(
      "cladd-surface cladd-gradient cladd-outline cladd-level-1 cladd-anim-popover z-50 max-h-(--bits-dropdown-menu-content-available-height) min-w-[10rem] origin-(--bits-dropdown-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-cladd-popover p-2 text-cladd-fg shadow-cladd-popover outline-none",
      className
    )}
    {...restProps}
  />
</DropdownMenuPortal>
