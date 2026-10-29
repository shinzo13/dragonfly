<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { all } from "#lib/api/lists.js";
  import type { ExchangeRate, Item } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import OldUi from "#lib/components/misc/OldUi.svelte";
  import { dateOnly, misc } from "#lib/components/misc/queries.js";
  import {
    link,
    muted,
    td,
    tdNum,
    th,
    thNum,
  } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { formatDate, formatNumber, toNumber } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";

  interface Pair {
    count: number;
    from: string;
    key: string;
    latest?: ExchangeRate;
    to: string;
  }

  const currencies = createQuery(misc.currencies);
  const rates = createQuery(() => ({
    queryFn: () => all<ExchangeRate>("/v1/exchange-rates"),
    queryKey: ["exchange-rates"],
  }));
  const flag = createQuery(() =>
    misc.config("configuration.enable_exchange_rates")
  );

  const names = $derived(
    new Map(
      (currencies.data ?? []).map((c) => [c.attributes.code, c.attributes.name])
    )
  );

  function collect(list: Item<ExchangeRate>[]): Pair[] {
    const pairs = new Map<string, Pair>();
    const add = (from: string, to: string) => {
      const key = [from, to].sort().join("-");
      const found = pairs.get(key);
      if (found) {
        return found;
      }
      const pair: Pair = { count: 0, from, key, to };
      pairs.set(key, pair);
      return pair;
    };
    const enabled = (currencies.data ?? [])
      .filter((c) => c.attributes.enabled)
      .sort(
        (a, b) =>
          Number(Boolean(b.attributes.primary)) -
            Number(Boolean(a.attributes.primary)) ||
          a.attributes.code.localeCompare(b.attributes.code)
      )
      .map((c) => c.attributes.code);
    for (const [i, from] of enabled.entries()) {
      for (const to of enabled.slice(i + 1)) {
        add(from, to);
      }
    }
    for (const { attributes: rate } of list) {
      const from = rate.from_currency_code ?? "";
      const to = rate.to_currency_code ?? "";
      if (from === to) {
        continue;
      }
      const pair = add(from, to);
      pair.count += 1;
      if (!pair.latest || (rate.date ?? "") > (pair.latest.date ?? "")) {
        pair.latest = rate;
      }
    }
    return [...pairs.values()].sort(
      (a, b) =>
        Number(b.count > 0) - Number(a.count > 0) ||
        a.from.localeCompare(b.from) ||
        a.to.localeCompare(b.to)
    );
  }

  const pairs = $derived(collect(rates.data ?? []));

  function latestRate(pair: Pair): number | null {
    if (!pair.latest) {
      return null;
    }
    const rate = toNumber(pair.latest.rate);
    return pair.latest.from_currency_code === pair.from ? rate : 1 / rate;
  }

  const open = (pair: Pair) => goto(`/exchange-rates/${pair.from}/${pair.to}`);

  const nav: ListNav<Pair> = new ListNav({
    id: "pairs",
    items: () => pairs,
    key: (pair) => pair.key,
    open,
  });
  nav.use();
</script>

<PageHeader crumbs={[{ label: "Exchange rates" }]} title="Exchange rates" />

<div class="flex flex-col gap-3">
  {#if flag.data === false}
    <OldUi href="/settings/configuration">
      Exchange rates are switched off in the Firefly III configuration, so
      amounts are not converted.
    </OldUi>
  {/if}
  <Box body="p-0" title="Exchange rates">
    {#if rates.isPending || currencies.isPending}
      <p class="p-3 {muted}">Loading exchange rates</p>
    {:else if rates.error}
      <p class="p-3 text-expense">{errorText(rates.error)}</p>
    {:else}
      <ListTable
        empty="Not enough currencies. If you have just one currency enabled, there is no need to add exchange rates."
        key={(pair) => pair.key}
        {nav}
      >
        {#snippet head()}
          <th class="{th} w-32">Pair</th>
          <th class="{th} hidden sm:table-cell">Between</th>
          <th class="{thNum} w-24">Rates</th>
          <th class="{th} w-36">Latest date</th>
          <th class="{thNum} w-40">Latest rate</th>
        {/snippet}
        {#snippet row(
          pair
        )}
          {@const rate = latestRate(pair)}
          <td class="{td} num">
            <a class={link} href="/exchange-rates/{pair.from}/{pair.to}"
              >{pair.from}
              → {pair.to}</a
            >
          </td>
          <td class="{td} hidden sm:table-cell">
            Between {names.get(pair.from) ?? pair.from} and
            {names.get(pair.to) ?? pair.to}
            (and the other way around)
          </td>
          <td class={tdNum}>{pair.count}</td>
          <td class="{td} num">{formatDate(dateOnly(pair.latest?.date))}</td>
          <td class={tdNum}>
            {rate === null ? "" : formatNumber(rate, 6)}
          </td>
        {/snippet}
      </ListTable>
    {/if}
  </Box>
</div>
