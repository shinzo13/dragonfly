<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import SelectPortal from "./select-portal.svelte";
  import SelectScrollUpButton from "./select-scroll-up-button.svelte";
  import SelectScrollDownButton from "./select-scroll-down-button.svelte";
  import { cn, type WithoutChild } from "#lib/utils.js";
  import type { ComponentProps } from "svelte";
  import type { WithoutChildrenOrChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    portalProps,
    children,
    preventScroll = true,
    ...restProps
  }: WithoutChild<SelectPrimitive.ContentProps> & {
    portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
  } = $props();
</script>

<SelectPortal {...portalProps}>
  <SelectPrimitive.Content
    bind:ref
    {sideOffset}
    {preventScroll}
    data-slot="select-content"
    class={cn(
      "cladd-surface cladd-gradient cladd-outline cladd-level-1 cladd-anim-popover z-50 max-h-(--bits-select-content-available-height) min-w-[10rem] origin-(--bits-select-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-cladd-popover text-cladd-fg shadow-cladd-popover outline-none",
      className
    )}
    {...restProps}
  >
    <SelectScrollUpButton />
    <SelectPrimitive.Viewport
      class={cn(
        "h-(--bits-select-anchor-height) w-full min-w-(--bits-select-anchor-width) scroll-my-2 p-2"
      )}
    >
      {@render children?.()}
    </SelectPrimitive.Viewport>
    <SelectScrollDownButton />
  </SelectPrimitive.Content>
</SelectPortal>
