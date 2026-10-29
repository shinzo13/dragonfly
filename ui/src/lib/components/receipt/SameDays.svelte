<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { all } from "#lib/api/lists.js";
  import type { Split, TransactionGroup } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import { addDays } from "#lib/dates.js";
  import { formatDate, type Money } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { journalId, signedAmount, toneOf } from "#lib/transactions/split.js";

  const DAYS = 2;
  const AROUND = 5;

  let {
    account,
    currency,
    day,
    groupId,
  }: {
    account: { id: string; name: string };
    currency: Omit<Money, "amount">;
    day: string;
    groupId: string;
  } = $props();

  const start = $derived(addDays(day, -DAYS));
  const end = $derived(addDays(day, DAYS));

  const query = createQuery(() => ({
    queryFn: () =>
      all<TransactionGroup>(`/v1/accounts/${account.id}/transactions`, {
        end,
        start,
      }),
    queryKey: ["receipt", "same-days", account.id, start, end],
  }));

  function amountOn(split: Split) {
    const signed = signedAmount(split, account.id);
    const foreign =
      split.foreign_currency_code === currency.code &&
      split.currency_code !== currency.code;
    if (!foreign) {
      return signed;
    }
    const sign = Math.sign(signed.amount) || 1;
    return {
      ...currency,
      amount: sign * Number(split.foreign_amount),
      tone: toneOf(split, sign < 0 ? -1 : 1),
    };
  }

  const rows = $derived(
    (query.data ?? [])
      .flatMap((group) =>
        group.attributes.transactions
          .filter(
            (split) =>
              split.source_id === account.id ||
              split.destination_id === account.id
          )
          .map((split) => ({
            balance:
              split.source_id === account.id
                ? split.source_balance_after
                : split.destination_balance_after,
            date: split.date.slice(0, 10),
            description: split.description,
            group: group.id,
            key: journalId(split),
            money: amountOn(split),
            self: group.id === groupId,
          }))
      )
      .reverse()
  );
  const shown = $derived.by(() => {
    const first = rows.findIndex((row) => row.self);
    const last = rows.findLastIndex((row) => row.self);
    return first < 0
      ? rows.slice(0, 2 * AROUND + 1)
      : rows.slice(Math.max(0, first - AROUND), last + AROUND + 1);
  });
</script>

{#snippet more()}
  <a
    class="text-brand hover:underline"
    href="/accounts/show/{account.id}/{start}/{end}"
    >All {rows.length} on {account.name} from {formatDate(start, "short")} to
    {formatDate(end, "short")}</a
  >
{/snippet}

<Box
  body="p-0"
  footer={shown.length < rows.length ? more : undefined}
  href="/accounts/show/{account.id}/{start}/{end}"
  title="Same days on {account.name}"
>
  {#if query.isPending}
    <p class="px-3 py-2.5 text-cladd-fg-soft">Loading {account.name}...</p>
  {:else if query.error}
    <p class="px-3 py-2.5 text-expense">{query.error.message}</p>
  {:else}
    <table class="w-full">
      <thead>
        <tr
          class="h-8 border-cladd-outline border-b text-left font-medium text-[12px] text-cladd-fg-soft"
        >
          <th class="px-3 font-medium">Date</th>
          <th class="px-2 font-medium">Description</th>
          <th class="px-2 text-right font-medium">Amount</th>
          <th class="px-3 text-right font-medium whitespace-nowrap">
            Balance after
          </th>
        </tr>
      </thead>
      <tbody>
        {#each shown as row (row.key)}
          <tr
            class="h-7 {row.self
              ? "bg-row-selected font-medium"
              : "hover:bg-row-hover"}"
          >
            <td class="num px-3 whitespace-nowrap text-cladd-fg-soft">
              {formatDate(row.date, "short")}
            </td>
            <td class="w-full max-w-0 truncate px-2">
              {#if row.self}
                {row.description}
              {:else}
                <a class="hover:underline" href="/transactions/show/{row.group}"
                  >{row.description}</a
                >
              {/if}
            </td>
            <td class="px-2 text-right whitespace-nowrap">
              <Amount
                amount={row.money.amount}
                code={row.money.code}
                decimals={row.money.decimals}
                symbol={row.money.symbol}
                tone={row.money.tone}
              />
            </td>
            <td class="num px-3 text-right whitespace-nowrap">
              {row.balance === null || row.balance === undefined
                ? ""
                : display.text([{ ...currency, amount: row.balance }])}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Box>
