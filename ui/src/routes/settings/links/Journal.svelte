<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { One, TransactionGroup } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import { link } from "#lib/components/misc/styles.js";

  let { id }: { id: string } = $props();

  const query = createQuery(() => ({
    queryFn: () => api<One<TransactionGroup>>(`/v1/transaction-journals/${id}`),
    queryKey: ["transaction-journal", id],
  }));
  const group = $derived(query.data?.data);
  const split = $derived(
    group?.attributes.transactions.find((s) => s.transaction_journal_id === id)
  );
  const tone = $derived(
    (
      {
        deposit: "income",
        transfer: "transfer",
        withdrawal: "expense",
      } as const
    )[split?.type as "deposit"] ?? "neutral"
  );
</script>

{#if group && split}
  <span class="flex items-baseline justify-between gap-3">
    <a class="truncate {link}" href="/transactions/show/{group.id}"
      >{split.description}</a
    >
    <Amount
      amount={split.amount}
      code={split.currency_code}
      decimals={split.currency_decimal_places}
      symbol={split.currency_symbol}
      {tone}
    />
  </span>
{:else if query.error}
  <span class="text-cladd-fg-soft">Transaction #{id}</span>
{/if}
