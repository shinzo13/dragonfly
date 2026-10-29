<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { lists } from "#lib/api/lists.js";
  import type { PiggyBank } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import Meter from "#lib/components/charts/Meter.svelte";
  import { percent, toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";

  const piggies = createQuery(() => lists.piggyBanks());

  const saving = $derived(
    (piggies.data ?? [])
      .filter((p) => toNumber(p.attributes.current_amount) > 0)
      .sort(
        (a, b) =>
          toNumber(a.attributes.percentage) - toNumber(b.attributes.percentage)
      )
  );

  const fmt = (p: PiggyBank, amount: string | null | undefined) =>
    display.text([
      {
        amount,
        code: p.currency_code,
        decimals: p.currency_decimal_places,
        symbol: p.currency_symbol,
      },
    ]);
</script>

{#if saving.length > 0}
  <Box href="/piggy-banks" title="Piggy banks">
    <ul class="flex flex-col gap-3">
      {#each saving as item (item.id)}
        {@const p = item.attributes}
        {@const target = toNumber(p.target_amount)}
        <li class="flex flex-col gap-1">
          <div class="flex items-baseline gap-2 text-[12.5px]">
            <a
              class="min-w-0 flex-1 truncate font-semibold text-cladd-fg hover:underline"
              href="/piggy-banks/show/{item.id}"
              >{p.name}</a
            >
            <span class="num shrink-0 text-[12px] text-cladd-fg-soft">
              <span class="text-cladd-fg">{fmt(p, p.current_amount)}</span>
              {#if target > 0}
                of {fmt(p, p.target_amount)}
              {/if}
            </span>
          </div>
          {#if target > 0}
            <div class="flex items-center gap-2">
              <Meter
                max={target}
                segments={[{ value: toNumber(p.current_amount) }]}
              />
              <span
                class="num w-10 shrink-0 text-right text-[11px] text-cladd-fg-soft"
                >{percent(toNumber(p.percentage) / 100)}</span
              >
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#snippet footer()}
      <a
        class="text-brand dark:text-(--ff-series-1) hover:underline"
        href="/piggy-banks"
        >Go to your piggy banks</a
      >
    {/snippet}
  </Box>
{/if}
