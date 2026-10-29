<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import {
    type Action,
    actionsFor,
    isDebt,
    movements,
  } from "#lib/accounts/ledger.js";
  import { all, lists } from "#lib/api/lists.js";
  import type { Account, Item, TransactionGroup } from "#lib/api/types.js";
  import type { Binding } from "#lib/keys.svelte.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";
  import DebtCard from "./DebtCard.svelte";

  const KEYS = { more: "+", offset: "=", repay: "S" };

  let { item }: { item: Item<Account> } = $props();

  const history = createQuery(() => ({
    queryFn: () =>
      all<TransactionGroup>(`/v1/accounts/${item.id}/transactions`),
    queryKey: ["debt-history", item.id],
  }));
  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));

  const list = $derived(
    history.data ? movements(item, history.data) : undefined
  );
  const plan = $derived(
    list && assets.data && liabilities.data
      ? actionsFor(
          item,
          list,
          assets.data,
          liabilities.data.filter((d) => isDebt(d) && d.attributes.active)
        )
      : null
  );

  const bind = (action: Action | null | undefined, keys: string): Binding[] =>
    action
      ? [
          {
            group: "Debt",
            keys,
            label: action.hint,
            run: () => goto(action.href),
          },
        ]
      : [];

  useKeys(() => [
    ...bind(plan?.repay, KEYS.repay),
    ...bind(plan?.more, KEYS.more),
    ...bind(plan?.offset, KEYS.offset),
  ]);
</script>

<DebtCard actions={plan} {item} keys={KEYS} {list} named={false} rows={0} />
