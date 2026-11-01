<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { One, TransactionGroup } from "#lib/api/types.js";
  import Editor from "#lib/components/editor/Editor.svelte";
  import { fromGroup, isEditableType } from "#lib/components/editor/model.js";
  import Context from "#lib/components/receipt/Context.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");

  const group = createQuery(() => ({
    queryFn: () => api<One<TransactionGroup>>(`/v1/transactions/${id}`),
    queryKey: ["transaction", id],
    staleTime: 0,
  }));

  const type = $derived(
    group.data?.data.attributes.transactions[0]?.type ?? ""
  );
</script>

{#key id}
  {#if group.isPending}
    <p class="py-8 text-cladd-fg-soft">Loading transaction #{id}</p>
  {:else if group.isError}
    <PageHeader subtitle="Edit transaction" title="Transactions" />
    <p class="text-expense">
      Transaction #{id}
      could not be loaded: {group.error.message}
    </p>
  {:else if group.data && !isEditableType(type)}
    <PageHeader subtitle="Edit transaction" title="Transactions" />
    <p class="text-[13px]">
      This is a {type}, which this editor does not change.
      <a
        class="text-brand underline"
        data-sveltekit-reload
        href="/transactions/edit/{id}?ffui=old"
        >Edit it in the old interface</a
      >
    </p>
  {:else if group.data}
    <div class="flex flex-col gap-3">
      <Editor group={group.data.data} initial={fromGroup(group.data.data)} />
      <Context group={group.data.data} />
    </div>
  {/if}
{/key}
