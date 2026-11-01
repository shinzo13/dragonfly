<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { Account, One } from "#lib/api/types.js";
  import AccountForm from "#lib/components/accounts/AccountForm.svelte";
  import {
    indexUrl,
    showUrl,
    TYPE_TITLE,
    typeOf,
  } from "#lib/components/accounts/links.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
  const account = createQuery(() => ({
    queryFn: () => api<One<Account>>(`/v1/accounts/${id}`),
    queryKey: ["account-edit", id],
    staleTime: 0,
  }));
  const item = $derived(account.data?.data);
  const type = $derived(item ? typeOf(item.attributes) : "asset");
</script>

<PageHeader
  crumbs={[
    { href: indexUrl(type), label: TYPE_TITLE[type] },
    { href: showUrl(id), label: item?.attributes.name ?? "" },
    { label: "Edit" },
  ]}
  title={item ? `Edit ${item.attributes.name}` : "Edit account"}
/>

{#if account.isError}
  <p class="text-expense">{account.error.message}</p>
{:else if item}
  {#key item.id}
    <AccountForm account={item} {type} />
  {/key}
{/if}
