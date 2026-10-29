<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { owed } from "#lib/accounts/ledger.js";
  import {
    balanceAt,
    chartRange,
    daily,
    monthsOf,
    moves,
    reconciledThrough,
    sideOf,
    signOf,
    sums,
    terms,
    viewOf,
  } from "#lib/accounts/statement.js";
  import { api } from "#lib/api/client.js";
  import { all } from "#lib/api/lists.js";
  import type { Account, Item, One, TransactionGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import LineChart from "#lib/components/charts/LineChart.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import { addDays, addMonths, contains, today } from "#lib/dates.js";
  import { currentLocale, formatDate, toNumber } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { sectionOf } from "#lib/transactions/ledger.js";
  import { goto } from "$app/navigation";
  import DebtPanel from "./DebtPanel.svelte";
  import { canReconcile, reconcileUrl, showUrl, typeOf } from "./links.js";
  import StatementHeader from "./StatementHeader.svelte";
  import StatementMonths from "./StatementMonths.svelte";

  const MOVED_KEY = "ffui.account.moved";
  const DAYS_KEY = "ffui.account.days";
  const TOGGLE =
    "inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2 text-[12px] text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg";
  const LINK = "text-brand dark:text-(--ff-series-1) hover:underline";

  let { item }: { item: Item<Account> } = $props();

  let moved = $state(localStorage.getItem(MOVED_KEY) !== "0");
  let days = $state(localStorage.getItem(DAYS_KEY) === "1");

  const now = today();
  const id = $derived(item.id);
  const a = $derived(item.attributes);
  const liability = $derived(typeOf(a) === "liabilities");
  const side = $derived(sideOf(a, liability));
  const sign = $derived(signOf(side));
  const cur = $derived({
    code: a.currency_code,
    decimals: a.currency_decimal_places,
    symbol: a.currency_symbol,
  });
  const view = $derived(viewOf(cur));
  const chart = $derived(chartRange(period.range, now));
  const span = $derived({
    end: [chart.end, period.end, now].sort().at(-1) ?? now,
    start: [chart.start, period.start].sort()[0],
  });

  const current = createQuery(() => ({
    enabled: !liability,
    queryFn: () =>
      api<One<Account>>(`/v1/accounts/${id}`, { query: { date: now } }),
    queryKey: ["account", id, now],
  }));
  const history = createQuery(() =>
    liability
      ? {
          queryFn: () =>
            all<TransactionGroup>(`/v1/accounts/${id}/transactions`),
          queryKey: ["debt-history", id],
        }
      : {
          placeholderData: keepPreviousData,
          queryFn: () =>
            all<TransactionGroup>(`/v1/accounts/${id}/transactions`, span),
          queryKey: ["account-history", id, span.start, span.end],
        }
  );

  const anchor = $derived.by(() => {
    if (liability) {
      return { balance: owed(a), date: now };
    }
    const value = current.data?.data.attributes.current_balance;
    return value === undefined ? null : { balance: toNumber(value), date: now };
  });
  const ready = $derived(
    Boolean(anchor && history.data) && !history.isPlaceholderData
  );
  const list = $derived(
    history.data ? moves(id, a.currency_code, history.data) : []
  );
  const at = (day: string) =>
    anchor ? sign * balanceAt(list, anchor, day) : 0;
  const opening = $derived(at(addDays(period.start, -1)));
  const closing = $derived(at(period.end));
  const parts = $derived(terms(side, sums(list, period.range).total));
  const months = $derived(monthsOf(chart, list));
  const line = $derived(
    anchor
      ? daily(list, anchor, chart).map((p) => ({
          x: p.x,
          y: sign * p.y * view.rate,
        }))
      : []
  );
  const groups = $derived(
    (history.data ?? []).filter((g) =>
      g.attributes.transactions.some((s) => contains(period.range, s.date))
    )
  );
  const through = $derived(reconciledThrough(list));
  const monthEnd = (month: string) => addDays(addMonths(month, 1), -1);
  const selected = $derived(
    period.start.endsWith("-01") && period.end === monthEnd(period.start)
      ? period.start
      : null
  );
  const thisMonth = `${now.slice(0, 7)}-01`;
  const lineTitle = $derived(side === "asset" ? "Balance" : "Debt balance");
  const series = $derived([
    {
      area: true,
      format: (value: number) => view.format(value),
      key: "balance",
      label: lineTitle,
      points: line,
    },
  ]);
  const monthYear = (value: string) =>
    new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
      currentLocale(),
      { month: "short", year: "2-digit" }
    );

  function pick(month: string) {
    goto(`${showUrl(id)}/${month}/${monthEnd(month)}`);
  }

  function toggleMoved() {
    moved = !moved;
    localStorage.setItem(MOVED_KEY, moved ? "1" : "0");
  }

  function toggleDays() {
    days = !days;
    localStorage.setItem(DAYS_KEY, days ? "1" : "0");
  }

  useKeys(() => [
    ...(item.attributes.liability_type === "debt"
      ? []
      : [
          {
            group: "Account",
            keys: "t",
            label: moved ? "Hide moved money" : "Show moved money",
            run: toggleMoved,
          },
        ]),
    {
      group: "Account",
      keys: ";",
      label: days ? "Hide day subtotals" : "Show day subtotals",
      run: toggleDays,
    },
  ]);
</script>

<div class="flex flex-col gap-3">
  <StatementHeader
    {closing}
    {cur}
    empty={!(anchor && history.data)}
    end={period.end}
    loading={!ready}
    {opening}
    {side}
    start={period.start}
    terms={parts}
  />

  <div
    class="grid gap-3 {a.liability_type === "debt"
      ? "xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
      : "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}"
  >
    {#if a.liability_type === "debt"}
      <DebtPanel {item} />
    {:else}
      <Box title="In and out by month">
        {#snippet tools()}
          <button class={TOGGLE} onclick={toggleMoved} type="button">
            {moved ? "Hide moved" : "Show moved"}
            <span class="kbd">t</span>
          </button>
        {/snippet}
        <div class="transition-opacity {ready ? "" : "opacity-60"}">
          <StatementMonths
            {cur}
            {months}
            {moved}
            onselect={pick}
            partial={thisMonth}
            {selected}
            {side}
          />
        </div>
      </Box>
    {/if}
    <Box title={lineTitle}>
      <div class="transition-opacity {ready ? "" : "opacity-60"}">
        {#if line.length > 0}
          <LineChart
            axisFormat={view.axis}
            height={236}
            label="{lineTitle} of {a.name} by day"
            marker={contains(chart, now) ? now : undefined}
            {series}
            toggle={false}
            xFormat={monthYear}
          />
        {:else}
          <div class="h-[264px]"></div>
        {/if}
      </div>
    </Box>
  </div>

  {#if a.notes}
    <Box title="Notes">
      <p class="whitespace-pre-wrap text-cladd-fg">{a.notes}</p>
    </Box>
  {/if}

  <Box body="p-0" title="Statement for {period.label}">
    {#snippet tools()}
      <span class="num text-[12px] text-cladd-fg-soft max-sm:hidden"
        >{groups.length}
        {groups.length === 1 ? "transaction" : "transactions"}</span
      >
      <button
        aria-pressed={days}
        class="{TOGGLE} {days ? "bg-cladd-surface-next text-cladd-fg" : ""}"
        onclick={toggleDays}
        type="button"
      >
        Day subtotals
        <span class="kbd">;</span>
      </button>
    {/snippet}
    <TransactionTable
      context={{ accountId: id }}
      empty="No transactions in this period."
      {groups}
      id="account-tx"
      loading={history.isFetching}
      section={days ? (group) => sectionOf("day", group) : undefined}
    />
    {#snippet footer()}
      {#if canReconcile(item)}
        <span class="text-cladd-fg-soft">
          {through
            ? `Reconciled through ${formatDate(through)}`
            : `Not reconciled since ${formatDate(span.start, "month")}`}
        </span>
        <a class={LINK} href={reconcileUrl(id)}
          >Reconcile {period.label} <span class="kbd">R</span></a
        >
      {/if}
      <a class="{LINK} ml-auto" href="{showUrl(id)}/all"
        >Show all transactions without grouping them by date</a
      >
    {/snippet}
  </Box>
</div>
