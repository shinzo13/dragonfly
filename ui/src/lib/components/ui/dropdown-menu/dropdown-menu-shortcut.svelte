<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
  bind:this={ref}
  data-slot="dropdown-menu-shortcut"
  class={cn(
    "ms-auto font-mono text-cladd-2xs text-cladd-fg-softer tracking-widest",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</span>
