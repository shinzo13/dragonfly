<script lang="ts">
  import { Progress as ProgressPrimitive } from "bits-ui";
  import { cn, type WithoutChildrenOrChild } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    max = 100,
    value,
    ...restProps
  }: WithoutChildrenOrChild<ProgressPrimitive.RootProps> = $props();
</script>

<ProgressPrimitive.Root
  bind:ref
  data-slot="progress"
  class={cn(
    "cladd-cut relative h-2 w-full overflow-hidden rounded-full",
    className
  )}
  {value}
  {max}
  {...restProps}
>
  <div
    data-slot="progress-indicator"
    class="cladd-surface cladd-gradient-fill cladd-color-brand h-full w-full flex-1 rounded-full transition-all duration-300 ease-out"
    style="transform: translateX(-{100 - (100 * (value ?? 0)) / (max ?? 1)}%)"
  ></div>
</ProgressPrimitive.Root>
