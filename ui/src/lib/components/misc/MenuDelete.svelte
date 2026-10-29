<script lang="ts">
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import type { Arm } from "./action.svelte.js";

  let {
    arm,
    id,
    run,
    label = "Delete",
  }: { arm: Arm; id: string; run: () => unknown; label?: string } = $props();

  const armed = $derived(arm.key === id);
</script>

<ContextMenuItem
  onSelect={(event) => {
    if (!armed) {
      event.preventDefault();
    }
    arm.press(id, run);
  }}
  variant="destructive"
>
  {armed ? "Press again to delete" : label}
  <span class="ml-auto kbd">D</span>
</ContextMenuItem>
