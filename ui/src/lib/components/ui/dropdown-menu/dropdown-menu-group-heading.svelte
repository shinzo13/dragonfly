<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "#lib/utils.js";
  import type { ComponentProps } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    ...restProps
  }: ComponentProps<typeof DropdownMenuPrimitive.GroupHeading> & {
    inset?: boolean;
  } = $props();
</script>

<DropdownMenuPrimitive.GroupHeading
  bind:ref
  data-slot="dropdown-menu-group-heading"
  data-inset={inset}
  class={cn(
    "cladd-section-title px-3 pt-2 pb-1.5 data-[inset]:ps-8 data-[inset]:ps-9",
    className
  )}
  {...restProps}
/>
