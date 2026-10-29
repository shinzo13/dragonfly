<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { prettyKeys } from "#lib/keys.svelte.js";

  export interface MenuItem {
    keys?: string;
    label: string;
    run: () => void;
  }

  let {
    items,
    ondelete,
    deleteLabel = "Delete",
    children,
  }: {
    items: () => MenuItem[];
    ondelete?: () => void | Promise<void>;
    deleteLabel?: string;
    children: Snippet<[Record<string, unknown>]>;
  } = $props();

  let armed = $state(false);
</script>

<ContextMenu onOpenChange={(open) => !open && (armed = false)}>
  <ContextMenuTrigger>
    {#snippet child({
      props,
    })}
      {@render children(props)}
    {/snippet}
  </ContextMenuTrigger>
  <ContextMenuContent class="min-w-52">
    {#each items() as item (item.label)}
      <ContextMenuItem onSelect={item.run}>
        {item.label}
        {#if item.keys}
          <ContextMenuShortcut
            >{prettyKeys(item.keys).join(" ")}</ContextMenuShortcut
          >
        {/if}
      </ContextMenuItem>
    {/each}
    {#if ondelete}
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={(event) => {
          if (!armed) {
            event.preventDefault();
            armed = true;
            return;
          }
          ondelete();
        }}
        variant="destructive"
      >
        {armed ? "Press again to delete" : deleteLabel}
      </ContextMenuItem>
    {/if}
  </ContextMenuContent>
</ContextMenu>
