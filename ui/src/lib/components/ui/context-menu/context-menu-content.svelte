<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn } from "#lib/utils.js";
  import ContextMenuPortal from "./context-menu-portal.svelte";
  import type { ComponentProps } from "svelte";
  import type { WithoutChildrenOrChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    portalProps,
    class: className,
    ...restProps
  }: ContextMenuPrimitive.ContentProps & {
    portalProps?: WithoutChildrenOrChild<
      ComponentProps<typeof ContextMenuPortal>
    >;
  } = $props();
</script>

<ContextMenuPortal {...portalProps}>
  <ContextMenuPrimitive.Content
    bind:ref
    data-slot="context-menu-content"
    class={cn(
      "cladd-surface cladd-gradient cladd-outline cladd-level-1 cladd-anim-popover z-50 max-h-(--bits-context-menu-content-available-height) min-w-[10rem] origin-(--bits-context-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-cladd-popover p-2 text-cladd-fg shadow-cladd-popover outline-none",
      className
    )}
    {...restProps}
  />
</ContextMenuPortal>
