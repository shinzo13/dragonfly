<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import {
    createQueries,
    createQuery,
    keepPreviousData,
  } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type {
    Account,
    Item,
    Page,
    TransactionGroup,
  } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import { editUrl, showUrl } from "#lib/components/accounts/links.js";
  import Box from "#lib/components/Box.svelte";
  import Sparkline from "#lib/components/charts/Sparkline.svelte";
  import { type Row, useColumn } from "#lib/dashboard/column.svelte.js";
  import { addDays, today } from "#lib/dates.js";
  import {
    formatDate,
    formatMoney,
    type Money,
    toNumber,
  } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import {
    groupTitle,
    signedAmount,
    editUrl as txEditUrl,
    showUrl as txShowUrl,
  } from "#lib/transactions/split.js";
  import { goto } from "$app/navigation";
  import {
    accountsChartQuery,
    accountsQuery,
    byCurrency,
    seriesPoints,
  } from "./data.js";

  const RECENT = 5;
  const TREND_DAYS = 30;
  const HISTORY_DAYS = 365;

  const now = today();
  let expanded = $state<string[]>([]);

  const assets = createQuery(() => ({
    ...accountsQuery("asset", period.start, period.end),
    placeholderData: keepPreviousData,
  }));
  const chart = createQuery(() =>
    accountsChartQuery(addDays(now, -TREND_DAYS), now)
  );
  const recent = createQueries(() => ({
    queries: expanded.map((id) => ({
      queryFn: () =>
        api<Page<TransactionGroup>>(`/v1/accounts/${id}/transactions`, {
          query: {
            end: now,
            limit: RECENT,
            start: addDays(now, -HISTORY_DAYS),
          },
        }),
      queryKey: ["account-recent", id, now],
    })),
  }));

  const shown = $derived.by(() => {
    const list = (assets.data ?? [])
      .filter((a) => a.attributes.active !== false)
      .sort((a, b) => (a.attributes.order ?? 0) - (b.attributes.order ?? 0));
    if (!("frontpageAccounts" in session.prefs)) {
      return list;
    }
    const ids = new Set(session.frontpageAccounts);
    return list.filter((a) => ids.has(a.id));
  });

  const trends = $derived(
    new Map(
      (chart.data ?? []).map((set) => [
        set.label,
        seriesPoints(set, false).map((p) => p.y),
      ])
    )
  );

  function sumSeries(series: number[][]): number[] {
    const length = Math.max(0, ...series.map((s) => s.length));
    return Array.from({ length }, (_, i) =>
      series.reduce((sum, s) => sum + (s[i] ?? 0), 0)
    );
  }

  const moneyOf = (a: Account, amount: Money["amount"]): Money => ({
    amount,
    code: a.currency_code,
    decimals: a.currency_decimal_places ?? 2,
    symbol: a.currency_symbol ?? a.currency_code,
  });

  const balances = $derived(
    shown.map((a) => moneyOf(a.attributes, a.attributes.current_balance))
  );
  const changes = $derived(
    shown.map((a) => moneyOf(a.attributes, a.attributes.balance_difference))
  );
  const total = $derived(display.total(balances));
  const change = $derived(display.total(changes));

  const sumOf = (
    accounts: Item<Account>[],
    pick: (a: Account) => string | null | undefined
  ) => accounts.reduce((s, a) => s + toNumber(pick(a.attributes)), 0);

  const converted = (a: Item<Account>) =>
    display.convert(
      toNumber(a.attributes.current_balance),
      a.attributes.currency_code
    ) ?? 0;

  const groups = $derived(
    total
      ? [
          {
            accounts: shown.toSorted((a, b) => converted(b) - converted(a)),
            balance: null,
            change: null,
            code: total.code,
            trend: [],
          },
        ]
      : byCurrency(shown, (a) => a.attributes.currency_code ?? "").map(
          ([code, accounts]) => ({
            accounts,
            balance: moneyOf(
              accounts[0].attributes,
              sumOf(accounts, (a) => a.current_balance)
            ),
            change: moneyOf(
              accounts[0].attributes,
              sumOf(accounts, (a) => a.balance_difference)
            ),
            code,
            trend: sumSeries(
              accounts.map((a) => trends.get(a.attributes.name) ?? [])
            ),
          })
        )
  );

  const recentRows = $derived(
    new Map(
      expanded.map((id, i) => [
        id,
        (recent[i]?.data?.data ?? [])
          .flatMap((group) =>
            group.attributes.transactions
              .filter((s) => s.source_id === id || s.destination_id === id)
              .map((split, n) => ({
                date: split.date.slice(0, 10),
                group,
                key: `acc-${id}-tx-${group.id}-${n}`,
                money: signedAmount(split, id),
                title:
                  group.attributes.transactions.length > 1
                    ? `${groupTitle(group)}: ${split.description}`
                    : split.description,
              }))
          )
          .slice(0, RECENT),
      ])
    )
  );

  const accountKey = (id: string) => `acc-${id}`;

  function expand(id: string) {
    if (expanded.includes(id)) {
      const first = recentRows.get(id)?.[0];
      if (first) {
        column.point(first.key);
      }
      return;
    }
    expanded = [...expanded, id];
  }

  function fold(id: string) {
    expanded = expanded.filter((e) => e !== id);
    column.point(accountKey(id));
  }

  function toggle(id: string) {
    if (expanded.includes(id)) {
      fold(id);
    } else {
      expand(id);
    }
  }

  const column = useColumn(1, () =>
    groups.flatMap((g) =>
      g.accounts.flatMap((account): Row[] => [
        {
          edit: () => goto(editUrl(account.id)),
          expand: () => expand(account.id),
          fold: () => fold(account.id),
          key: accountKey(account.id),
          open: () => goto(showUrl(account.id)),
        },
        ...(recentRows.get(account.id) ?? []).map((tx) => ({
          edit: () => goto(txEditUrl(tx.group.id)),
          fold: () => fold(account.id),
          key: tx.key,
          open: () => goto(txShowUrl(tx.group.id)),
        })),
      ])
    )
  );

  const trendColor = (values: number[]) =>
    (values.at(-1) ?? 0) < (values[0] ?? 0)
      ? "var(--ff-expense)"
      : "var(--ff-income)";
</script>

{#snippet spark(
  values: number[]
)}
  {#if values.length > 1}
    <Sparkline color={trendColor(values)} height={18} {values} width={56} />
  {/if}
{/snippet}

{#snippet balance(
  money: Money
)}
  <span
    class="num font-medium {toNumber(money.amount) < 0
      ? "text-expense"
      : "text-cladd-fg"}"
    title={display.active && money.code !== display.code
      ? formatMoney(money)
      : undefined}
    >{display.text([money])}</span
  >
{/snippet}

<Box body="p-0" href="/accounts/asset" title="Accounts">
  {#snippet tools()}
    {#if total}
      <span class="num font-semibold text-[13px] text-cladd-fg"
        >{display.text(balances)}</span
      >
      {#if change?.amount}
        <span
          class="num text-[12px] {change.amount < 0
            ? "text-expense"
            : "text-income"}"
          >{display.text(changes, true)}</span
        >
      {/if}
    {/if}
  {/snippet}
  {#if shown.length === 0}
    <p class="px-3 py-3 text-cladd-fg-soft">
      {assets.isPending ? "" : "No accounts on the home screen."}
    </p>
  {:else}
    <table
      class="w-full border-collapse text-[13px] transition-opacity {assets.isPlaceholderData
        ? "opacity-60"
        : ""}"
    >
      <thead>
        <tr class="h-7 text-[11px] text-cladd-fg-soft">
          <th class="w-full pl-3 text-left font-normal" scope="col">Account</th>
          <th class="px-2 text-right font-normal" scope="col">Balance</th>
          <th class="px-2 text-right font-normal" scope="col">This period</th>
          <th
            class="hidden pr-3 text-right font-normal sm:table-cell"
            scope="col"
          >
            {TREND_DAYS}
            days
          </th>
        </tr>
      </thead>
      {#each groups as group (group.code)}
        <tbody class="border-cladd-outline border-t">
          {#if group.balance && group.change}
            <tr class="h-7 bg-cladd-surface-next/60 font-semibold">
              <th
                class="pl-3 text-left text-[12px] text-cladd-fg"
                scope="rowgroup"
              >
                {group.code}
              </th>
              <td class="whitespace-nowrap px-2 text-right">
                {@render balance(group.balance)}
              </td>
              <td class="whitespace-nowrap px-2 text-right">
                {#if toNumber(group.change.amount) !== 0}
                  <Amount {...group.change} signed />
                {/if}
              </td>
              <td class="hidden pr-3 sm:table-cell">
                <div class="flex justify-end">
                  {@render spark(group.trend)}
                </div>
              </td>
            </tr>
          {/if}
          {#each group.accounts as account (account.id)}
            {@const a = account.attributes}
            {@const key = accountKey(account.id)}
            {@const open = expanded.includes(account.id)}
            <tr
              class="h-7 border-cladd-outline/60 border-t {column.rowClass(
                key
              )}"
              id={column.id(key)}
              onclick={() => column.point(key)}
            >
              <td class="max-w-0 pl-1">
                <div class="flex min-w-0 items-center">
                  <button
                    aria-expanded={open}
                    aria-label="Last transactions of {a.name}"
                    class="grid size-6 shrink-0 place-items-center rounded-cladd-sm text-cladd-fg-soft hover:text-cladd-fg"
                    onclick={() => toggle(account.id)}
                    type="button"
                  >
                    <ChevronRight
                      class="size-3.5 transition-transform {open
                        ? "rotate-90"
                        : ""}"
                    />
                  </button>
                  <a
                    class="truncate text-cladd-fg hover:underline"
                    href={showUrl(account.id)}
                    title={a.name}
                    >{a.name}</a
                  >
                </div>
              </td>
              <td class="whitespace-nowrap px-2 text-right">
                {@render balance(moneyOf(a, a.current_balance))}
              </td>
              <td class="whitespace-nowrap px-2 text-right">
                {#if toNumber(a.balance_difference) !== 0}
                  <Amount {...moneyOf(a, a.balance_difference)} signed />
                {/if}
              </td>
              <td class="hidden pr-3 sm:table-cell">
                <div class="flex justify-end">
                  {@render spark(trends.get(a.name) ?? [])}
                </div>
              </td>
            </tr>
            {#if open}
              {#each recentRows.get(account.id) ?? [] as tx (tx.key)}
                <tr
                  class="h-7 text-[12px] {column.rowClass(tx.key)}"
                  id={column.id(tx.key)}
                  onclick={() => column.point(tx.key)}
                >
                  <td class="max-w-0 pl-7" colspan="2">
                    <a
                      class="flex min-w-0 items-baseline gap-2 hover:underline"
                      href={txShowUrl(tx.group.id)}
                    >
                      <span class="num w-12 shrink-0 text-cladd-fg-soft"
                        >{formatDate(tx.date, "short")}</span
                      >
                      <span class="truncate text-cladd-fg-soft" title={tx.title}
                        >{tx.title}</span
                      >
                    </a>
                  </td>
                  <td class="whitespace-nowrap px-2 text-right">
                    <Amount {...tx.money} signed />
                  </td>
                  <td class="hidden sm:table-cell"></td>
                </tr>
              {:else}
                <tr class="h-7 text-[12px]">
                  <td class="pl-7 text-cladd-fg-soft" colspan="4">
                    {recent[expanded.indexOf(account.id)]?.isPending
                      ? ""
                      : "Nothing in the last year."}
                  </td>
                </tr>
              {/each}
            {/if}
          {/each}
        </tbody>
      {/each}
    </table>
  {/if}
</Box>
