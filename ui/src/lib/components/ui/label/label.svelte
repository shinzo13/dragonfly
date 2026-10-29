<script lang="ts">
  import { Label as LabelPrimitive } from "bits-ui";
  import { cn } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: {
    ref?: any;
    class?: string;
    children?: any;
    [key: string]: any;
  } = $props();
</script>

<LabelPrimitive.Root
  bind:ref
  class={cn(
    "font-medium text-cladd-fg-soft text-cladd-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</LabelPrimitive.Root>
