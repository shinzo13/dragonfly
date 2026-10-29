<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn } from "#lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: ContextMenuPrimitive.SeparatorProps = $props();
</script>

<ContextMenuPrimitive.Separator
  bind:ref
  data-slot="context-menu-separator"
  class={cn("-mx-2 my-2 h-px bg-cladd-bg-outline", className)}
  {...restProps}
/>
