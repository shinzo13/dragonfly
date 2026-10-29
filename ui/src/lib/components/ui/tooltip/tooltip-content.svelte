<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { cn } from "#lib/utils.js";
  import TooltipPortal from "./tooltip-portal.svelte";
  import type { ComponentProps } from "svelte";
  import type { WithoutChildrenOrChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 6,
    side = "top",
    children,
    portalProps,
    ...restProps
  }: TooltipPrimitive.ContentProps & {
    portalProps?: WithoutChildrenOrChild<ComponentProps<typeof TooltipPortal>>;
  } = $props();
</script>

<TooltipPortal {...portalProps}>
  <TooltipPrimitive.Content
    bind:ref
    data-slot="tooltip-content"
    {sideOffset}
    {side}
    class={cn(
      "cladd-surface cladd-gradient cladd-outline cladd-level-5 cladd-anim-tooltip z-50 w-fit max-w-72 origin-(--bits-tooltip-content-transform-origin) text-balance rounded-cladd-tooltip px-2 py-1 font-medium text-cladd-fg text-cladd-xs leading-normal",
      className
    )}
    {...restProps}
  >
    {@render children?.()}
  </TooltipPrimitive.Content>
</TooltipPortal>
