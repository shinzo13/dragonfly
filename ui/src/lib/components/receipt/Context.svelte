<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import type { Item, TransactionGroup } from "#lib/api/types.js";
  import Place from "./Place.svelte";
  import SameDays from "./SameDays.svelte";
  import { loadPlace, placeOf, visitOf, visitsIn } from "./usual.js";

  const OWN = {
    deposit: "destination",
    transfer: "source",
    withdrawal: "source",
  } as const;
  const TONE: Record<string, string> = {
    deposit: "text-income",
    transfer: "text-transfer",
    withdrawal: "text-expense",
  };

  let { group }: { group: Item<TransactionGroup> } = $props();

  const splits = $derived(group.attributes.transactions);
  const first = $derived(splits[0]);
  const day = $derived(first.date.slice(0, 10));
  const currency = $derived({
    code: first.currency_code,
    decimals: first.currency_decimal_places,
    symbol: first.currency_symbol,
  });
  const currencies = $derived(
    [
      currency,
      {
        code: first.foreign_currency_code,
        decimals: first.foreign_currency_decimal_places,
        symbol: first.foreign_currency_symbol,
      },
    ].filter((option) => option.code)
  );
  const place = $derived(placeOf(splits));
  const own = $derived.by(() => {
    const side = OWN[first.type as keyof typeof OWN];
    const id = side ? first[`${side}_id`] : null;
    return side && id ? { id, name: first[`${side}_name`] ?? "" } : null;
  });

  const history = createQuery(() => ({
    enabled: place !== null,
    queryFn: () =>
      place ? loadPlace(place, group.id, day) : Promise.resolve([]),
    queryKey: ["receipt", "place", group.id, place?.id, day],
  }));

  const best = $derived.by(() => {
    if (!place) {
      return null;
    }
    const options = currencies.flatMap((option) => {
      const current = visitOf(group, place, option.code ?? "");
      return current
        ? [
            {
              currency: option,
              current,
              past: visitsIn(history.data ?? [], place, option.code ?? ""),
            },
          ]
        : [];
    });
    return options.reduce<(typeof options)[number] | null>(
      (top, option) =>
        top && top.past.length >= option.past.length ? top : option,
      null
    );
  });
</script>

{#if best || own}
  <div class="grid items-stretch gap-3 lg:grid-cols-2">
    {#if place && best}
      <Place
        currency={best.currency}
        current={best.current}
        loading={history.isPending}
        past={best.past}
        {place}
        tone={TONE[first.type] ?? "text-cladd-fg"}
      />
    {/if}
    {#if own}
      <SameDays account={own} {currency} {day} groupId={group.id} />
    {/if}
  </div>
{/if}
