<script lang="ts">
  import SuggestInput from "#lib/components/transactions/SuggestInput.svelte";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { manualCards } from "#lib/subscriptions/manual.svelte.js";
  import type { Card } from "#lib/subscriptions/runway.js";
  import type { Suggestion } from "#lib/transactions/query.js";

  const AUTO = "\u0000";

  let { billIds, cards }: { billIds: string[]; cards: Card[] } = $props();

  let text = $state("");
  let input = $state<HTMLInputElement>();

  const suggestions = $derived.by<Suggestion[]>(() => {
    const found = fuzzyFilter(cards, text, (c) => c.name, 20).map((c) => ({
      hint: c.code,
      id: c.id,
      insert: c.id,
      label: c.name,
    }));
    return text.trim()
      ? found
      : [
          { id: AUTO, insert: AUTO, label: "Card of the last payment" },
          ...found,
        ];
  });

  $effect(() => {
    input?.focus();
  });

  const cancel = () => (manualCards.picking = null);
</script>

<SuggestInput
  aria-label="Paying card"
  class="w-56"
  id="bill-card-{billIds[0]}"
  onaccept={(item) => {
    manualCards.set(billIds, item.insert === AUTO ? null : item.insert);
    return true;
  }}
  onblur={cancel}
  oncancel={cancel}
  onsubmit={cancel}
  placeholder={billIds.length > 1
    ? `Paying card for ${billIds.length}`
    : "Paying card"}
  {suggestions}
  bind:input
  bind:value={text}
/>
