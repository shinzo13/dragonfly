<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "#lib/utils.js";
  import type { CladdColor } from "../button/button.svelte";

  let {
    ref = $bindable(null),
    as = "div",
    outline = true,
    hoverable = false,
    color,
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> & {
    as?: string;
    outline?: boolean;
    hoverable?: boolean;
    color?: CladdColor;
  } = $props();
</script>

<!-- A recessed well: sits below its parent surface instead of above it. -->
<svelte:element
  this={as}
  bind:this={ref}
  data-slot="surface-cut"
  class={cn(
    "cladd-cut text-cladd-fg",
    !outline && "shadow-none",
    hoverable && "cladd-hoverable",
    color && `cladd-color-${color}`,
    className
  )}
  {...restProps}
>
  {@render children?.()}
</svelte:element>
