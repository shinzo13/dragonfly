<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { One, Tag } from "#lib/api/types.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import TagForm from "#lib/components/tags/TagForm.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.tag ?? "");
  const query = createQuery(() => ({
    queryFn: () => api<One<Tag>>(`/v1/tags/${encodeURIComponent(id)}`),
    queryKey: ["tag", id],
  }));
  const name = $derived(query.data?.data.attributes.tag ?? "");
</script>

<PageHeader
  crumbs={[
    { href: "/tags", label: "Tags" },
    { href: `/tags/show/${query.data?.data.id ?? id}`, label: name || "Tag" },
    { label: "Edit" },
  ]}
  title={name ? `Edit tag "${name}"` : "Edit tag"}
/>
{#if query.data}
  {#key query.data.data.id}
    <TagForm tag={query.data.data} />
  {/key}
{:else if query.isError}
  <p class="text-expense">{query.error.message}</p>
{/if}
