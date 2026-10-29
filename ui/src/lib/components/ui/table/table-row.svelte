<script lang="ts">
  import { cn, type WithElementRef } from "#lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableRowElement>> = $props();
</script>

<tr
  bind:this={ref}
  data-slot="table-row"
  class={cn(
    "border-cladd-bg-outline border-b transition-colors duration-200 data-[state=selected]:bg-cladd-surface-hover hover:[&,&>svelte-css-wrapper]:[&>th,td]:bg-cladd-surface-hover",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</tr>
