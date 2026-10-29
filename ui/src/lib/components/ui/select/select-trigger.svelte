<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import { cn, type WithoutChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    size = "default",
    ...restProps
  }: WithoutChild<SelectPrimitive.TriggerProps> & {
    size?: "sm" | "default";
  } = $props();
</script>

<SelectPrimitive.Trigger
  bind:ref
  data-slot="select-trigger"
  data-size={size}
  class={cn(
    "cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-clickable cladd-focusable flex w-fit select-none items-center justify-between gap-2 whitespace-nowrap rounded-cladd-md px-2.5 font-semibold text-cladd-fg text-cladd-xs disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:outline-destructive data-[size=default]:h-cladd-md data-[size=sm]:h-cladd-sm data-[placeholder]:text-cladd-fg-softer *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-cladd-fg-softer [&_svg]:pointer-events-none [&_svg]:shrink-0",
    className
  )}
  {...restProps}
>
  {@render children?.()}
  <ChevronsUpDownIcon class="size-3.5 text-cladd-fg-softer" />
</SelectPrimitive.Trigger>
