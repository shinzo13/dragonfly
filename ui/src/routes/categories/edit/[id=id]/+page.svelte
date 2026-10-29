<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { Category, One } from "#lib/api/types.js";
  import CategoryForm from "#lib/components/categories/CategoryForm.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
  const query = createQuery(() => ({
    queryFn: () => api<One<Category>>(`/v1/categories/${id}`),
    queryKey: ["category", id],
  }));
  const name = $derived(query.data?.data.attributes.name ?? "");
</script>

<PageHeader
  crumbs={[
    { href: "/categories", label: "Categories" },
    { href: `/categories/show/${id}`, label: name || "Category" },
    { label: "Edit" },
  ]}
  title={name ? `Edit category "${name}"` : "Edit category"}
/>
{#if query.data}
  {#key query.data.data.id}
    <CategoryForm category={query.data.data} />
  {/key}
{:else if query.isError}
  <p class="text-expense">{query.error.message}</p>
{/if}
