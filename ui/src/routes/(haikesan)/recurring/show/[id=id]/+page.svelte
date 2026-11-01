<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { One, Recurrence, TransactionGroup } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { Action, errorText } from "#lib/components/misc/action.svelte.js";
  import { dateOnly } from "#lib/components/misc/queries.js";
  import Status from "#lib/components/misc/Status.svelte";
  import {
    link,
    muted,
    td,
    tdNum,
    th,
    thNum,
  } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import { today } from "#lib/dates.js";
  import { formatDate } from "#lib/format.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    describe,
    endsText,
    stopped,
    TYPES,
    toneOf,
  } from "../../recurrence.js";

  const id = $derived(page.params.id ?? "");
  const query = createQuery(() => ({
    queryFn: () => api<One<Recurrence>>(`/v1/recurrences/${id}`),
    queryKey: ["recurrence", id],
  }));
  const created = createQuery(() => ({
    queryFn: () => all<TransactionGroup>(`/v1/recurrences/${id}/transactions`),
    queryKey: ["recurrence-transactions", id],
  }));

  const r = $derived(query.data?.data.attributes);
  const type = $derived(TYPES[r?.type ?? ""] ?? "Transaction");
  const plural = $derived(`${type.toLowerCase()}s`);
  const count = $derived(created.data?.length ?? 0);
  const remaining = $derived(
    r?.nr_of_repetitions ? Math.max(0, r.nr_of_repetitions - count) : null
  );
  const createdDates = $derived(
    new Set(
      (created.data ?? []).map((g) =>
        (g.attributes.transactions[0]?.date ?? "").slice(0, 10)
      )
    )
  );

  function dates(occurrences: string[] = []) {
    const now = today();
    const list = occurrences.map((d) => d.slice(0, 10)).filter((d) => d >= now);
    return remaining === null ? list : list.slice(0, remaining);
  }

  let firing = $state<string | null>(null);
  let fired = $state<Record<string, string>>({});

  async function trigger(date: string) {
    firing = date;
    try {
      const result = await api<{ data: unknown[] }>(
        `/v1/recurrences/${id}/trigger`,
        { method: "POST", query: { date } }
      );
      fired = {
        ...fired,
        [date]: result.data.length > 0 ? "Created" : "Nothing to create",
      };
      await invalidate();
    } catch (error) {
      fired = { ...fired, [date]: errorText(error) };
    } finally {
      firing = null;
    }
  }

  const removal = new Action();
  async function remove() {
    const ok = await removal.run(
      () => api(`/v1/recurrences/${id}`, { method: "DELETE" }),
      "Deleted"
    );
    if (ok) {
      await invalidate();
      await goto("/recurring");
    }
  }

  const title = $derived(
    r
      ? `Overview for recurring transaction "${r.title}"`
      : "Recurring transaction"
  );
</script>

<PageHeader
  crumbs={[
    { href: "/recurring", label: "Recurring transactions" },
    { label: r?.title ?? "Recurring transaction" },
  ]}
  {title}
/>

{#if r}
  <div class="flex flex-col gap-4">
    <div class="grid items-start gap-4 lg:grid-cols-3">
      <Box
        class="lg:col-span-2"
        title="{r.title} ({type.toLowerCase()}){r.active ? "" : " (inactive)"}"
      >
        <div class="flex flex-col gap-2">
          {#if r.description}
            <p>{r.description}</p>
          {/if}
          {#if !r.active}
            <p class="text-warn">
              This recurring transaction is not active and will not generate new
              transactions.
            </p>
          {/if}
          {#if r.nr_of_repetitions}
            <p class={remaining === 0 ? "text-expense" : ""}>
              This recurring transaction will be created at most
              {r.nr_of_repetitions}
              times, and has been created {count} times already.
            </p>
          {/if}
          <dl class="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 gap-y-1">
            <dt class="text-cladd-fg-soft">Repeats</dt>
            <dd>
              {#each r.repetitions ?? [] as rep, i (rep.id ?? i)}
                <div>{describe(rep)}</div>
              {/each}
            </dd>
            <dt class="text-cladd-fg-soft">First date</dt>
            <dd class="num">{formatDate(dateOnly(r.first_date))}</dd>
            <dt class="text-cladd-fg-soft">Ends</dt>
            <dd class={stopped(r) ? "text-expense" : ""}>
              {stopped(r)
                ? `This recurring transaction stopped repeating on ${formatDate(dateOnly(r.repeat_until))}.`
                : endsText(r)}
            </dd>
            <dt class="text-cladd-fg-soft">Last created</dt>
            <dd class={r.latest_date ? "num" : ""}>
              {r.latest_date ? formatDate(dateOnly(r.latest_date)) : "Never"}
            </dd>
            <dt class="text-cladd-fg-soft">Apply rules</dt>
            <dd>{r.apply_rules ? "Yes" : "No"}</dd>
            {#if r.notes}
              <dt class="text-cladd-fg-soft">Notes</dt>
              <dd class="whitespace-pre-line">{r.notes}</dd>
            {/if}
          </dl>
        </div>
        {#snippet footer()}
          <Button
            data-sveltekit-reload
            href="/recurring/edit/{id}"
            size="sm"
            variant="outline"
            >Edit in the old interface</Button
          >
          <span class="ml-auto flex items-center gap-2">
            <Status action={removal} busy="Deleting" />
            <ConfirmButton
              confirmLabel={count > 0
                ? `Press again, the ${count} created stay`
                : "Press again to delete"}
              onconfirm={remove}
              >Delete</ConfirmButton
            >
          </span>
        {/snippet}
      </Box>

      <Box body="p-0" title="Expected {plural}">
        {#each r.repetitions ?? [] as rep, i (rep.id ?? i)}
          <h3 class="border-cladd-outline border-b px-3 py-1.5 font-semibold">
            {describe(rep)}
          </h3>
          <table class="w-full text-[13px]">
            <tbody>
              {#each dates(rep.occurrences) as date (date)}
                <tr
                  class="h-7 border-cladd-outline/60 border-b last:border-b-0"
                >
                  <td class="{td} num pl-3">{formatDate(date)}</td>
                  <td class="{td} pr-3 text-right">
                    {#if fired[date]}
                      <span class="text-[12px] text-cladd-fg-soft"
                        >{fired[date]}</span
                      >
                    {:else if createdDates.has(date)}
                      <span class="text-[12px] text-cladd-fg-soft"
                        >Created</span
                      >
                    {:else}
                      <Button
                        disabled={firing !== null}
                        onclick={() => trigger(date)}
                        size="xs"
                        variant="outline"
                        >Create right now</Button
                      >
                    {/if}
                  </td>
                </tr>
              {:else}
                <tr>
                  <td class="px-3 py-2 {muted}">No upcoming dates.</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/each}
      </Box>
    </div>

    <Box body="p-0" title="Transaction data">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th class={th}>Description</th>
              <th class={th}>Source account</th>
              <th class={th}>Destination account</th>
              <th class={thNum}>Amount</th>
              <th class={th}>Category</th>
              <th class={th}>Budget</th>
              <th class={th}>Other</th>
            </tr>
          </thead>
          <tbody>
            {#each r.transactions ?? [] as tx, i (tx.id ?? i)}
              <tr class="h-7 border-cladd-outline/60 border-b last:border-b-0">
                <td class={td}>{tx.description}</td>
                <td class={td}>
                  <a class={link} href="/accounts/show/{tx.source_id}"
                    >{tx.source_name}</a
                  >
                </td>
                <td class={td}>
                  <a class={link} href="/accounts/show/{tx.destination_id}"
                    >{tx.destination_name}</a
                  >
                </td>
                <td class={tdNum}>
                  <Amount
                    amount={tx.amount}
                    code={tx.currency_code}
                    decimals={tx.currency_decimal_places}
                    symbol={tx.currency_symbol}
                    tone={toneOf(r.type)}
                  />
                  {#if tx.foreign_amount}
                    <span class="text-cladd-fg-soft">
                      (<Amount
                        amount={tx.foreign_amount}
                        code={tx.foreign_currency_code}
                        decimals={tx.foreign_currency_decimal_places}
                        exact
                        symbol={tx.foreign_currency_symbol}
                        tone="neutral"
                      />)
                    </span>
                  {/if}
                </td>
                <td class={td}>
                  {#if tx.category_id}
                    <a class={link} href="/categories/show/{tx.category_id}"
                      >{tx.category_name}</a
                    >
                  {/if}
                </td>
                <td class={td}>
                  {#if tx.budget_id}
                    <a class={link} href="/budgets/show/{tx.budget_id}"
                      >{tx.budget_name}</a
                    >
                  {/if}
                </td>
                <td class="{td} text-[12px]">
                  {#if tx.tags?.length}
                    <div>Tags: {tx.tags.join(", ")}</div>
                  {/if}
                  {#if tx.piggy_bank_id}
                    <div>
                      Piggy bank:
                      <a
                        class={link}
                        href="/piggy-banks/show/{tx.piggy_bank_id}"
                        >{tx.piggy_bank_name}</a
                      >
                    </div>
                  {/if}
                  {#if tx.subscription_id}
                    <div>
                      Subscription:
                      <a
                        class={link}
                        href="/subscriptions/show/{tx.subscription_id}"
                        >{tx.subscription_name}</a
                      >
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Box>

    <Box body="p-0" title="Created {plural}">
      <TransactionTable
        empty="Nothing created yet."
        groups={created.data ?? []}
        id="created"
        loading={created.isPending}
        selectable={false}
      />
    </Box>
  </div>
{:else if query.error}
  <p class="text-expense">{errorText(query.error)}</p>
{:else}
  <p class={muted}>Loading recurring transaction</p>
{/if}
