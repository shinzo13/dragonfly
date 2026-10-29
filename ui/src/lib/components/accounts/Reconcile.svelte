<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { createQuery } from "@tanstack/svelte-query";
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type {
    Account,
    One,
    Split,
    TransactionGroup,
  } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import { currency, money } from "#lib/components/dashboard/data.js";
  import DateInput from "#lib/components/inputs/DateInput.svelte";
  import { INPUT } from "#lib/components/inputs/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { addDays } from "#lib/dates.js";
  import { formatDate, toNumber } from "#lib/format.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import {
    type Group,
    groupTitle,
    signedAmount,
    signedForeign,
  } from "#lib/transactions/split.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { indexUrl, showUrl, TYPE_TITLE } from "./links.js";

  const MARGIN_DAYS = 3;
  const CENT = 0.005;

  interface Row {
    amount: number;
    cleared: boolean;
    date: string;
    group: Group;
    inRange: boolean;
    key: string;
    split: Split;
  }

  let { id, start, end }: { id: string; start: string; end: string } = $props();

  let startInput = $state(untrack(() => start));
  let endInput = $state(untrack(() => end));
  let startText = $state("");
  let endText = $state("");
  let startTouched = $state(false);
  let endTouched = $state(false);
  let correct = $state(false);
  let busy = $state(false);
  let status = $state("");
  let failure = $state("");
  let pressed = $state(false);

  const account = createQuery(() => ({
    queryFn: () => api<One<Account>>(`/v1/accounts/${id}`),
    queryKey: ["account", id, "reconcile"],
  }));
  const a = $derived(account.data?.data.attributes);
  const cur = $derived(currency(a?.currency_code ?? ""));
  const fmt = $derived(money(cur));

  const balanceAt = (date: string) => async () => {
    const res = await api<One<Account>>(`/v1/accounts/${id}`, {
      query: { date },
    });
    return toNumber(res.data.attributes.current_balance);
  };
  const before = createQuery(() => ({
    queryFn: balanceAt(addDays(start, -1)),
    queryKey: ["reconcile-balance", id, addDays(start, -1)],
    staleTime: 0,
  }));
  const after = createQuery(() => ({
    queryFn: balanceAt(end),
    queryKey: ["reconcile-balance", id, end],
    staleTime: 0,
  }));
  const list = createQuery(() => ({
    queryFn: () =>
      all<TransactionGroup>(`/v1/accounts/${id}/transactions`, {
        end: addDays(end, MARGIN_DAYS),
        start: addDays(start, -MARGIN_DAYS),
      }),
    queryKey: ["reconcile-list", id, start, end],
    staleTime: 0,
  }));

  function net(split: Split): number {
    const code = a?.currency_code;
    if (split.currency_code !== code && split.foreign_currency_code === code) {
      return signedForeign(split, id)?.amount ?? 0;
    }
    return signedAmount(split, id).amount;
  }

  const rows = $derived<Row[]>(
    (list.data ?? [])
      .flatMap((group) =>
        group.attributes.transactions
          .filter((s) => s.source_id === id || s.destination_id === id)
          .map((split) => {
            const date = split.date.slice(0, 10);
            return {
              amount: net(split),
              cleared: split.reconciled === true,
              date,
              group,
              inRange: date >= start && date <= end,
              key: split.transaction_journal_id ?? "",
              split,
            };
          })
      )
      .sort((x, y) => y.split.date.localeCompare(x.split.date))
  );
  const open = $derived(rows.filter((r) => r.inRange && !r.cleared));
  const later = $derived(rows.filter((r) => r.date > end));
  const inside = $derived(rows.filter((r) => r.inRange));
  const earlier = $derived(rows.filter((r) => r.date < start));

  const nav = new ListNav<Row>({
    extra: () => [
      {
        group: "Reconcile",
        input: true,
        keys: "mod+Enter",
        label: "Store reconciliation",
        run: () => store(),
      },
    ],
    id: "reconcile",
    items: () => open,
    key: (row) => row.key,
    selectable: true,
  });
  nav.use();

  useKeys(() => [
    {
      group: "Reconcile",
      keys: "c",
      label: "Toggle the correction",
      run: () => {
        correct = canCorrect && !correct;
      },
    },
  ]);

  const startBalance = $derived(
    startTouched ? toNumber(startText) : (before.data ?? 0)
  );
  const endBalance = $derived(
    endTouched ? toNumber(endText) : (after.data ?? 0)
  );
  const selected = $derived(open.filter((r) => nav.isSelected(r)));
  const selectedSum = $derived(selected.reduce((s, r) => s + r.amount, 0));
  const cleared = $derived(inside.filter((r) => r.cleared));
  const clearedSum = $derived(cleared.reduce((s, r) => s + r.amount, 0));
  const sum = $derived(startBalance + selectedSum + clearedSum);
  const difference = $derived.by(() => {
    const value = sum - endBalance;
    return Math.abs(value) < CENT ? 0 : value;
  });
  const reconciliationAccounts = createQuery(() => ({
    queryFn: () => all<Account>("/v1/accounts", { type: "reconciliation" }),
    queryKey: ["accounts", "reconciliation"],
  }));
  const reconciliationId = $derived(
    reconciliationAccounts.data?.find(
      (r) => r.attributes.name === `${a?.name} reconciliation (${cur.code})`
    )?.id
  );
  const canCorrect = $derived(Boolean(reconciliationId));
  const correcting = $derived(correct && canCorrect && difference !== 0);
  const ready = $derived(before.isSuccess && after.isSuccess && list.isSuccess);
  const hint = $derived.by(() => {
    if (!pressed) {
      return "";
    }
    if (!ready) {
      return "Balances are still loading";
    }
    return selected.length === 0 && !correcting
      ? "Tick the transactions to clear first"
      : "";
  });

  function setDates(nextStart: string, nextEnd: string) {
    if (!(nextStart && nextEnd) || nextStart > nextEnd) {
      return;
    }
    startTouched = false;
    endTouched = false;
    nav.clear();
    goto(`/accounts/reconcile/${id}/index/${nextStart}/${nextEnd}`, {
      replace: true,
    });
  }

  async function clear(group: Group, journals: Set<string>) {
    let splits = group.attributes.transactions;
    let title = group.attributes.group_title;
    if (title) {
      const full = await api<One<TransactionGroup>>(
        `/v1/transactions/${group.id}`
      );
      splits = full.data.attributes.transactions;
      title = full.data.attributes.group_title || groupTitle(full.data);
    }
    const body: Record<string, unknown> = {
      transactions: splits.map((s) =>
        journals.has(s.transaction_journal_id ?? "")
          ? {
              reconciled: true,
              transaction_journal_id: s.transaction_journal_id,
            }
          : { transaction_journal_id: s.transaction_journal_id }
      ),
    };
    if (splits.length > 1) {
      body.group_title = title;
    }
    await api(`/v1/transactions/${group.id}`, { body, method: "PUT" });
  }

  function correction(other: string) {
    const sides =
      difference > 0
        ? { destination_id: other, source_id: id }
        : { destination_id: id, source_id: other };
    return {
      apply_rules: false,
      fire_webhooks: false,
      transactions: [
        {
          amount: Math.abs(difference).toFixed(cur.decimals),
          currency_code: cur.code,
          date: end,
          description: `Reconciliation (${formatDate(start)} to ${formatDate(end)})`,
          reconciled: true,
          type: "reconciliation",
          ...sides,
        },
      ],
    };
  }

  async function store() {
    pressed = true;
    if (busy || hint) {
      return;
    }
    busy = true;
    failure = "";
    const byGroup = new Map<string, { group: Group; journals: Set<string> }>();
    for (const row of selected) {
      const entry = byGroup.get(row.group.id) ?? {
        group: row.group,
        journals: new Set<string>(),
      };
      entry.journals.add(row.key);
      byGroup.set(row.group.id, entry);
    }
    try {
      let done = 0;
      status = `Clearing ${selected.length} transactions`;
      await Promise.all(
        [...byGroup.values()].map(async ({ group, journals }) => {
          await clear(group, journals);
          done += 1;
          status = `Cleared ${done} of ${byGroup.size}`;
        })
      );
      if (correcting) {
        status = "Booking the correction";
        await api("/v1/transactions", {
          body: correction(reconciliationId ?? ""),
          method: "POST",
        });
      }
      status = "Reconciliation stored";
      await invalidate();
      await goto(showUrl(id));
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
      status = "";
      await list.refetch();
    } finally {
      busy = false;
    }
  }

  function rowClass(row: Row) {
    const i = open.indexOf(row);
    if (i >= 0 && nav.cursor === i) {
      return "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]";
    }
    if (nav.isSelected(row)) {
      return "bg-row-selected";
    }
    return row.inRange ? "hover:bg-row-hover" : "text-cladd-fg-softer";
  }
</script>

{#snippet marker(
  text: string
)}
  <tr class="h-7 border-cladd-outline border-t bg-cladd-surface-cut">
    <td class="px-3 font-semibold text-[12px] text-cladd-fg-soft" colspan="6">
      {text}
    </td>
  </tr>
{/snippet}

{#snippet line(
  row: Row
)}
  {@const i = open.indexOf(row)}
  <tr
    class="h-7 border-cladd-outline/60 border-t {rowClass(row)}"
    id={i >= 0 ? nav.rowId(i) : undefined}
    onclick={(event) => i >= 0 && nav.click(i, event)}
  >
    <td class="w-9 px-3">
      {#if row.cleared}
        <Check aria-label="Already reconciled" class="size-3.5 text-income" />
      {:else if row.inRange}
        <input
          aria-label="Reconcile {row.split.description}"
          checked={nav.isSelected(row)}
          class="size-4 accent-[var(--ff-brand)]"
          onchange={() => nav.toggle(row)}
          onclick={(event) => event.stopPropagation()}
          type="checkbox"
        >
      {/if}
    </td>
    <td class="num w-28 whitespace-nowrap px-3 text-cladd-fg-soft">
      {formatDate(row.date)}
    </td>
    <td class="max-w-0 truncate px-3">
      <a class="hover:underline" href="/transactions/show/{row.group.id}"
        >{row.split.description}</a
      >
    </td>
    <td class="whitespace-nowrap px-3 text-right">
      <Amount amount={row.amount} exact {...cur} />
    </td>
    <td class="hidden max-w-0 truncate px-3 text-cladd-fg-soft md:table-cell">
      {row.split.source_name}
    </td>
    <td class="hidden max-w-0 truncate px-3 text-cladd-fg-soft md:table-cell">
      {row.split.destination_name}
    </td>
  </tr>
{/snippet}

<PageHeader
  crumbs={[
    { href: indexUrl("asset"), label: TYPE_TITLE.asset },
    { href: showUrl(id), label: a?.name ?? "" },
    { label: "Reconcile" },
  ]}
  title="Reconcile {a?.name ?? "account"}"
/>

{#if a && a.type !== "asset"}
  <p class="text-expense">
    You can only reconcile asset accounts.
    <a class="text-brand dark:text-(--ff-series-1) underline" href={showUrl(id)}
      >Back to {a.name}</a
    >
  </p>
{:else}
  <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_25rem]">
    <Box body="flex flex-col p-0" title="Reconciliation range">
      <table class="w-full text-[13px]">
        <thead class="border-cladd-outline border-b text-left">
          <tr class="h-8 text-[12px] text-cladd-fg-soft">
            <th class="px-3 font-semibold" scope="col"></th>
            <th class="px-3 font-semibold" scope="col">Date</th>
            <th class="px-3 text-right font-semibold" scope="col">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr class="h-11">
            <th class="px-3 text-left font-semibold" scope="row">
              Start balance
            </th>
            <td class="px-3">
              <DateInput aria-label="Start date" bind:value={startInput} />
            </td>
            <td class="px-3">
              <input
                aria-label="Start balance"
                class="{INPUT} num text-right"
                inputmode="decimal"
                oninput={(event) => {
                  startTouched = true;
                  startText = event.currentTarget.value;
                }}
                value={startTouched
                  ? startText
                  : (before.data?.toFixed(cur.decimals) ?? "")}
              >
            </td>
          </tr>
          <tr class="h-11 border-cladd-outline/60 border-t">
            <th class="px-3 text-left font-semibold" scope="row">
              End balance
            </th>
            <td class="px-3">
              <DateInput aria-label="End date" bind:value={endInput} />
            </td>
            <td class="px-3">
              <input
                aria-label="End balance"
                class="{INPUT} num text-right"
                inputmode="decimal"
                oninput={(event) => {
                  endTouched = true;
                  endText = event.currentTarget.value;
                }}
                value={endTouched
                  ? endText
                  : (after.data?.toFixed(cur.decimals) ?? "")}
              >
            </td>
          </tr>
        </tbody>
      </table>
      {#if startInput !== start || endInput !== end}
        <div
          class="flex items-center gap-3 border-cladd-outline border-t px-3 py-2"
        >
          <Button onclick={() => setDates(startInput, endInput)} size="sm"
            >Update selection</Button
          >
          <span class="text-[12px] text-warn"
            >Changing the range clears the ticks.</span
          >
        </div>
      {/if}
      <p
        class="mt-auto border-cladd-outline border-t px-3 py-2 text-[12px] text-cladd-fg-soft"
      >
        Match the dates and balances to your bank statement, then tick the
        transactions that appear on it.
        <span class="kbd">x</span>
        ticks the row under the cursor,
        <span class="kbd">*</span>
        ticks all.
      </p>
    </Box>

    <Box body="flex flex-col gap-3 p-3" title="Reconciliation options">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-cladd-fg-soft">Difference</span>
        <span
          class="num font-semibold text-[20px] {difference === 0
            ? "text-income"
            : "text-expense"}"
          >{fmt(difference)}</span
        >
      </div>
      <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[12px]">
        <dt class="text-cladd-fg-soft">Submitted start balance</dt>
        <dd class="num text-right">{fmt(startBalance)}</dd>
        <dt class="text-cladd-fg-soft">
          Selected transactions ({selected.length})
        </dt>
        <dd class="num text-right">{fmt(selectedSum)}</dd>
        <dt class="text-cladd-fg-soft">
          Already cleared transactions ({cleared.length})
        </dt>
        <dd class="num text-right">{fmt(clearedSum)}</dd>
        <dt class="text-cladd-fg-soft">Sum of reconciliation</dt>
        <dd class="num text-right">{fmt(sum)}</dd>
        <dt class="text-cladd-fg-soft">Submitted end balance</dt>
        <dd class="num text-right">{fmt(endBalance)}</dd>
      </dl>
      {#if difference !== 0}
        <p class="text-[12px] text-cladd-fg-soft">
          Your Firefly III ledger has {difference > 0 ? "more" : "less"} money
          in it than your bank says.
        </p>
        <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0 text-[12px]">
          <legend class="sr-only">What to do with the difference</legend>
          <label class="flex items-start gap-2">
            <input
              class="mt-0.5 accent-[var(--ff-brand)]"
              name="correct"
              type="radio"
              value={false}
              bind:group={correct}
            >
            Clear the selected transactions, but do not correct.
          </label>
          <label
            class="flex items-start gap-2 {canCorrect
              ? ""
              : "text-cladd-fg-softer"}"
          >
            <input
              class="mt-0.5 accent-[var(--ff-brand)]"
              disabled={!canCorrect}
              name="correct"
              type="radio"
              value={true}
              bind:group={correct}
            >
            Clear the selected transactions, and create a correction
            {difference > 0 ? "removing" : "adding"}
            {fmt(Math.abs(difference))}
            {difference > 0 ? "from" : "to"}
            this asset account.
            <span class="kbd">c</span>
          </label>
          {#if !canCorrect && reconciliationAccounts.isSuccess}
            <p class="text-cladd-fg-soft">
              The first correction for this account has to be booked in
              <a
                class="text-brand dark:text-(--ff-series-1) underline"
                data-sveltekit-reload
                href="{page.url.pathname}?ffui=old"
                >Firefly's own reconcile page</a
              >: through the API, Firefly III cannot create the account that
              holds corrections.
            </p>
          {/if}
        </fieldset>
      {/if}
      <div class="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onclick={store} type="button"
          >Store reconciliation</Button
        >
        <span class="flex gap-1">
          {#each prettyKeys("mod+Enter") as key (key)}
            <span class="kbd">{key}</span>
          {/each}
        </span>
        {#if hint}
          <span class="text-[12px] text-expense" role="alert">{hint}</span>
        {/if}
      </div>
      {#if status}
        <p class="text-[12px] text-cladd-fg-soft" role="status">{status}</p>
      {/if}
      {#if failure}
        <p class="text-[12px] text-expense" role="alert">{failure}</p>
      {/if}
    </Box>
  </div>

  <Box body="p-0" class="mt-3" title="Transactions">
    {#snippet tools()}
      <span class="num text-[12px] text-cladd-fg-soft"
        >{open.length}
        to check, {cleared.length} already cleared</span
      >
    {/snippet}
    {#if list.isPending}
      <div class="h-40"></div>
    {:else if list.isError}
      <p class="p-3 text-expense">{list.error.message}</p>
    {:else}
      <table class="w-full table-fixed border-collapse text-[13px]">
        <colgroup>
          <col class="w-9">
          <col class="w-28">
          <col>
          <col class="w-36">
          <col class="hidden md:table-column md:w-48">
          <col class="hidden md:table-column md:w-48">
        </colgroup>
        <tbody>
          {#each later as row (row.key)}
            {@render line(row)}
          {/each}
          {@render marker(`End of reconcile period: ${formatDate(end)}`)}
          {#each inside as row (row.key)}
            {@render line(row)}
          {/each}
          {#if inside.length === 0}
            <tr>
              <td class="px-3 py-4 text-center text-cladd-fg-soft" colspan="6">
                No transactions in this range.
              </td>
            </tr>
          {/if}
          {@render marker(`Start of reconcile period: ${formatDate(start)}`)}
          {#each earlier as row (row.key)}
            {@render line(row)}
          {/each}
        </tbody>
      </table>
    {/if}
  </Box>
{/if}
