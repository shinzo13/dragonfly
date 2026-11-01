<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { Budget, One } from "#lib/api/types.js";
  import BudgetForm from "#lib/components/budgets/BudgetForm.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
  const query = createQuery(() => ({
    queryFn: () => api<One<Budget>>(`/v1/budgets/${id}`),
    queryKey: ["budget", id],
  }));
  const name = $derived(query.data?.data.attributes.name ?? "");
</script>

<PageHeader
  crumbs={[
    { href: "/budgets", label: "Budgets" },
    { href: `/budgets/show/${id}`, label: name || "Budget" },
    { label: "Edit" },
  ]}
  title={name ? `Edit budget "${name}"` : "Edit budget"}
/>
{#if query.data}
  {#key query.data.data.id}
    <BudgetForm budget={query.data.data} />
  {/key}
{:else if query.isError}
  <p class="text-expense">{query.error.message}</p>
{/if}
