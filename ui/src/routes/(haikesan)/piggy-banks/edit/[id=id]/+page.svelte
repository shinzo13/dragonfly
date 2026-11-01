<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { One, PiggyBank } from "#lib/api/types.js";
  import PiggyForm from "#lib/components/piggy-banks/PiggyForm.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
  const piggy = createQuery(() => ({
    queryFn: () => api<One<PiggyBank>>(`/v1/piggy-banks/${id}`),
    queryKey: ["piggy-bank", id],
  }));
  const name = $derived(piggy.data?.data.attributes.name ?? "");
</script>

<PageHeader
  crumbs={[
    { href: "/piggy-banks", label: "Piggy banks" },
    { href: `/piggy-banks/show/${id}`, label: name || id },
    { label: "Edit" },
  ]}
  title={name ? `Edit piggy bank "${name}"` : "Edit piggy bank"}
/>

{#if piggy.data}
  {#key id}
    <PiggyForm piggy={piggy.data.data} />
  {/key}
{:else if piggy.error}
  <p class="text-expense">{piggy.error.message}</p>
{:else}
  <p class="text-cladd-fg-soft">Loading piggy bank</p>
{/if}
