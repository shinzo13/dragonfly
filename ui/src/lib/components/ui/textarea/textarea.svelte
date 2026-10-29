<script lang="ts">
  import { cn, type WithElementRef, type WithoutChildren } from "#lib/utils.js";
  import type { HTMLTextareaAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    "data-slot": dataSlot = "textarea",
    ...restProps
  }: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
  bind:this={ref}
  data-slot={dataSlot}
  class={cn(
    "cladd-cut cladd-hoverable cladd-focusable-input field-sizing-content flex min-h-16 w-full rounded-cladd-md px-2.5 py-1.5 font-medium text-cladd-fg text-cladd-xs leading-relaxed selection:bg-brand/30 placeholder:text-cladd-fg-softer disabled:cursor-not-allowed disabled:opacity-50",
    className
  )}
  bind:value
  {...restProps}
></textarea>
