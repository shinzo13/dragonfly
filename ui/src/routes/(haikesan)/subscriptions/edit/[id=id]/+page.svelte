<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { Bill, One } from "#lib/api/types.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import BillForm from "#lib/components/subscriptions/BillForm.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
  const bill = createQuery(() => ({
    queryFn: () => api<One<Bill>>(`/v1/bills/${id}`),
    queryKey: ["bill", id],
  }));
  const name = $derived(bill.data?.data.attributes.name ?? "");
</script>

<PageHeader
  crumbs={[
    { href: "/subscriptions", label: "Subscriptions" },
    { href: `/subscriptions/show/${id}`, label: name || id },
    { label: "Edit" },
  ]}
  title={name ? `Edit subscription "${name}"` : "Edit subscription"}
/>

{#if bill.data}
  {#key id}
    <BillForm bill={bill.data.data} />
  {/key}
{:else if bill.error}
  <p class="text-expense">{bill.error.message}</p>
{:else}
  <p class="text-cladd-fg-soft">Loading subscription</p>
{/if}
