<script lang="ts">
  import { cn, type WithElementRef } from "#lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {} = $props();
</script>

<div
  bind:this={ref}
  data-slot="select-label"
  class={cn(
    "cladd-section-title px-3 pt-2 pb-1.5 data-[inset]:ps-9",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</div>
