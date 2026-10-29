<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import {
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { manualCards } from "#lib/subscriptions/manual.svelte.js";
  import type { Card } from "#lib/subscriptions/runway.js";

  let { billIds, cards }: { billIds: string[]; cards: Card[] } = $props();

  const chosen = $derived(billIds.map((id) => manualCards.get(id)));
  const shared = $derived(chosen.every((id) => id === chosen[0]) && chosen[0]);
</script>

<ContextMenuSub>
  <ContextMenuSubTrigger
    >{billIds.length > 1
      ? `Paying card for ${billIds.length}`
      : "Paying card"}</ContextMenuSubTrigger
  >
  <ContextMenuSubContent class="max-h-80 w-60">
    {#each cards as card (card.id)}
      <ContextMenuItem onSelect={() => manualCards.set(billIds, card.id)}>
        <span class="flex-1 truncate">{card.name}</span>
        <span class="text-[11px] text-cladd-fg-softer">{card.code}</span>
        {#if shared === card.id}
          <Check class="size-3.5" />
        {/if}
      </ContextMenuItem>
    {/each}
    <ContextMenuSeparator />
    <ContextMenuItem
      disabled={!chosen.some(Boolean)}
      onSelect={() => manualCards.set(billIds, null)}
      >Card of the last payment</ContextMenuItem
    >
  </ContextMenuSubContent>
</ContextMenuSub>
