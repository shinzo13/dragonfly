<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type {
    Bill,
    One,
    Page,
    Rule,
    TransactionGroup,
  } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import Columns from "#lib/components/charts/Columns.svelte";
  import { seriesColor, tones } from "#lib/components/charts/chart.js";
  import {
    LINK,
    sumByCurrency,
    type Total,
  } from "#lib/components/groups/object-groups.js";
  import Totals from "#lib/components/groups/Totals.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import {
    nextExpected,
    repeats,
    status,
  } from "#lib/components/subscriptions/bills.js";
  import PaidStatus from "#lib/components/subscriptions/PaidStatus.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import { buttonVariants } from "#lib/components/ui/button/button.svelte";
  import { addMonths } from "#lib/dates.js";
  import {
    formatDate,
    formatMoney,
    formatNumber,
    toNumber,
  } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { creep, toPayments } from "#lib/subscriptions/runway.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const LEADING_DAY = /^\d+\s*/;
  const id = $derived(page.params.id ?? "");

  const query = createQuery(() => ({
    enabled: period.ready,
    queryFn: () =>
      api<One<Bill>>(`/v1/bills/${id}`, {
        query: { end: period.end, start: period.start },
      }),
    queryKey: ["bill", id, period.start, period.end],
  }));
  const rules = createQuery(() => ({
    queryFn: () => api<Page<Rule>>(`/v1/bills/${id}/rules`),
    queryKey: ["bill", id, "rules"],
  }));
  const transactions = createQuery(() => ({
    queryFn: () => all<TransactionGroup>(`/v1/bills/${id}/transactions`),
    queryKey: ["bill", id, "transactions"],
  }));

  const bill = $derived(query.data?.data.attributes);
  const payments = $derived(
    (transactions.data ?? []).flatMap((g) =>
      g.attributes.transactions
        .filter((t) => t.bill_id === id)
        .map((t) => {
          const foreign =
            t.foreign_currency_code === bill?.currency_code &&
            toNumber(t.foreign_amount) !== 0;
          return {
            amount: Math.abs(toNumber(foreign ? t.foreign_amount : t.amount)),
            code: (foreign ? t.foreign_currency_code : t.currency_code) ?? "",
            date: t.date.slice(0, 10),
            decimals:
              (foreign
                ? t.foreign_currency_decimal_places
                : t.currency_decimal_places) ?? 2,
            symbol:
              (foreign ? t.foreign_currency_symbol : t.currency_symbol) ?? "",
          };
        })
    )
  );
  type Payment = (typeof payments)[number];

  const change = $derived(
    bill &&
      creep(
        bill,
        toPayments(transactions.data ?? []).filter((p) => p.billId === id)
      )
  );

  function averages(list: Payment[]): Total[] {
    return sumByCurrency(list).map((t) => ({
      ...t,
      amount: t.amount / list.filter((p) => p.code === t.code).length,
    }));
  }

  const year = $derived(period.start.slice(0, 4));
  const yearAverage = $derived(
    averages(payments.filter((p) => p.date.startsWith(year)))
  );
  const overallAverage = $derived(averages(payments));

  const codes = $derived([...new Set(payments.map((p) => p.code))]);
  const chartRows = $derived.by(() => {
    if (payments.length === 0) {
      return [];
    }
    const dates = payments.map((p) => p.date.slice(0, 7)).sort();
    const months: string[] = [];
    for (
      let m = `${dates[0]}-01`;
      m.slice(0, 7) <= (dates.at(-1) ?? "");
      m = addMonths(m, 1)
    ) {
      months.push(m.slice(0, 7));
    }
    const min = toNumber(bill?.amount_min);
    const max = toNumber(bill?.amount_max);
    return months.map((month) => {
      const values = Object.fromEntries(
        codes.map((code) => [
          code,
          payments
            .filter((p) => p.code === code && p.date.startsWith(month))
            .reduce((sum, p) => sum + p.amount, 0),
        ])
      );
      const own = values[bill?.currency_code ?? ""] ?? 0;
      return {
        color: own > 0 && (own < min || own > max) ? tones.warn : undefined,
        key: month,
        label: formatDate(`${month}-01`, "short").replace(LEADING_DAY, ""),
        note: month.slice(0, 4),
        values,
      };
    });
  });
  const chartKeys = $derived(
    codes.map((code, i) => ({
      color: seriesColor(i),
      key: code,
      label: `Paid in ${code}`,
    }))
  );

  async function remove() {
    await api(`/v1/bills/${id}`, { method: "DELETE" });
    await goto("/subscriptions");
    await invalidate();
  }

  useKeys(() => [
    {
      group: "Subscription",
      keys: "E",
      label: "Edit subscription",
      run: () => goto(`/subscriptions/edit/${id}`),
    },
  ]);

  const label = "w-1/2 px-3 py-1.5 align-top text-cladd-fg-soft";
  const value = "px-3 py-1.5";
</script>

<PageHeader
  crumbs={[
    { href: "/subscriptions", label: "Subscriptions" },
    { label: bill?.name ?? id },
  ]}
  title={bill?.name ?? "Subscription"}
>
  {#snippet actions()}
    <a
      class={buttonVariants({ size: "sm", variant: "outline" })}
      href="/subscriptions/edit/{id}"
      >Edit <span class="kbd">E</span></a
    >
  {/snippet}
</PageHeader>

{#if query.error}
  <p class="text-expense">{query.error.message}</p>
{:else if !bill}
  <p class="text-cladd-fg-soft">Loading subscription</p>
{:else}
  <div class="grid items-start gap-3 lg:grid-cols-2">
    <Box body="p-0" title={bill.name ?? ""}>
      <table class="w-full text-[13px]">
        <tbody>
          <tr class="border-cladd-outline/60 border-b">
            <td class="{value} leading-6" colspan="2">
              Matches transactions between
              <Amount
                amount={bill.amount_min}
                decimals={bill.currency_decimal_places}
                exact
                symbol={bill.currency_symbol}
                tone="expense"
              />
              and
              <Amount
                amount={bill.amount_max}
                decimals={bill.currency_decimal_places}
                exact
                symbol={bill.currency_symbol}
                tone="expense"
              />. Repeats {repeats(bill)}.
            </td>
          </tr>
          <tr class="border-cladd-outline/60 border-b">
            <td class={label}>Subscription is active</td>
            <td class={value}>{bill.active ? "Yes" : "No"}</td>
          </tr>
          <tr class="border-cladd-outline/60 border-b">
            <td class={label}>Paid this period ({period.label})</td>
            <td class={value}>
              <PaidStatus state={status(bill, period.range)} />
            </td>
          </tr>
          <tr class="border-cladd-outline/60 border-b">
            <td class={label}>Next expected match</td>
            <td class="{value} num">
              {formatDate(nextExpected(bill)) || "unknown"}
            </td>
          </tr>
          {#if change}
            <tr class="border-cladd-outline/60 border-b">
              <td class={label}>Price change</td>
              <td class={value}>
                <span
                  class="num {change.to > change.from
                    ? "text-expense"
                    : "text-income"}"
                  >{formatNumber(change.from, change.decimals)}
                  → {formatNumber(change.to, change.decimals)}
                  {change.code}</span
                >
                <span class="text-cladd-fg-soft"
                  >since {formatDate(change.since, "short")}</span
                >
              </td>
            </tr>
          {/if}
          <tr class="border-cladd-outline/60 border-b">
            <td class={label}>Group</td>
            <td class={value}>
              {#if bill.object_group_id}
                <a class={LINK} href="/groups/edit/{bill.object_group_id}"
                  >{bill.object_group_title}</a
                >
              {:else}
                <span class="text-cladd-fg-softer">No group</span>
              {/if}
            </td>
          </tr>
          {#if bill.end_date}
            <tr class="border-cladd-outline/60 border-b">
              <td class={label}>End date</td>
              <td class="{value} num">{formatDate(bill.end_date)}</td>
            </tr>
          {/if}
          {#if bill.extension_date}
            <tr class="border-cladd-outline/60 border-b">
              <td class={label}>Extension date</td>
              <td class="{value} num">{formatDate(bill.extension_date)}</td>
            </tr>
          {/if}
          <tr class="border-cladd-outline/60 border-b">
            <td class={label}>Average subscription amount ({year})</td>
            <td class="{value} text-right">
              <Totals
                empty={transactions.isPending ? "" : "No transactions"}
                tone="expense"
                totals={yearAverage}
              />
            </td>
          </tr>
          <tr>
            <td class={label}>Average subscription amount (overall)</td>
            <td class="{value} text-right">
              <Totals
                empty={transactions.isPending ? "" : "No transactions"}
                tone="expense"
                totals={overallAverage}
              />
            </td>
          </tr>
        </tbody>
      </table>
      {#snippet footer()}
        <a
          class={buttonVariants({ size: "sm", variant: "outline" })}
          href="/subscriptions/edit/{id}"
          >Edit</a
        >
        <a
          class={buttonVariants({ size: "sm", variant: "ghost" })}
          data-sveltekit-reload
          href={oldUiUrl(`${page.url.origin}/subscriptions/show/${id}`)}
          >Open in old UI</a
        >
        <ConfirmButton class="ms-auto" onconfirm={remove}>Delete</ConfirmButton>
      {/snippet}
    </Box>
    <div class="flex flex-col gap-3">
      <Box body="p-3" title="Rules related to this subscription">
        {#if rules.data?.data.length}
          <ul class="flex flex-col gap-1">
            {#each rules.data.data as rule (rule.id)}
              <li>
                <a
                  class={LINK}
                  data-sveltekit-reload
                  href="/rules/edit/{rule.id}"
                  >{rule.attributes.title}</a
                >
                {#if !rule.attributes.active}
                  <span class="text-cladd-fg-softer">(inactive rule)</span>
                {/if}
              </li>
            {/each}
          </ul>
        {:else if rules.isPending}
          <p class="text-cladd-fg-soft">Loading rules</p>
        {:else}
          <p class="text-cladd-fg-soft">
            No rule links transactions to this subscription.
          </p>
        {/if}
        {#snippet footer()}
          <a
            class={buttonVariants({ size: "sm", variant: "outline" })}
            data-sveltekit-reload
            href="/rules/create-from-bill/{id}"
            >Create rule from subscription</a
          >
        {/snippet}
      </Box>
      {#if bill.notes}
        <Box title="Notes">
          <p class="whitespace-pre-wrap">{bill.notes}</p>
        </Box>
      {/if}
    </div>
  </div>

  <Box class="mt-3" title="Chart">
    {#if chartRows.length > 0}
      <Columns
        format={(v) =>
          formatMoney({
            amount: v,
            decimals: payments[0]?.decimals,
            symbol: codes.length === 1 ? payments[0]?.symbol : null,
          })}
        height={220}
        keys={chartKeys}
        label="Paid per month"
        rows={chartRows}
      />
    {:else}
      <p class="text-cladd-fg-soft">
        {transactions.isPending
          ? "Loading transactions"
          : "No transactions are linked to this subscription yet."}
      </p>
    {/if}
  </Box>

  <Box body="p-0" class="mt-3" title="Connected transactions">
    <TransactionTable
      empty="No transactions are linked to this subscription."
      groups={transactions.data ?? []}
      id="bill-transactions"
      loading={transactions.isPending}
    />
  </Box>
{/if}
