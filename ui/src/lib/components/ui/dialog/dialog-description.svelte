<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
  bind:ref
  data-slot="dialog-description"
  class={cn("text-cladd-fg-soft text-cladd-sm leading-relaxed", className)}
  {...restProps}
/>
