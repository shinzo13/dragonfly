<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { errorText } from "#lib/components/misc/action.svelte.js";
  import { muted } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";
  import LinkTypeForm from "../../LinkTypeForm.svelte";
  import { linkQueries } from "../../queries.js";

  const id = $derived(page.params.id ?? "");
  const query = createQuery(() => linkQueries.one(id));
  const item = $derived(query.data?.data);
  const subtitle = $derived(
    item ? `Edit link type "${item.attributes.name}"` : "Edit link type"
  );
</script>

<PageHeader
  crumbs={[
    { href: "/settings", label: "System settings" },
    { href: "/settings/links", label: "Transaction links configuration" },
    { label: subtitle },
  ]}
  {subtitle}
  title="System settings"
/>
{#if item}
  {#key item.id}
    <LinkTypeForm {item} />
  {/key}
{:else if query.error}
  <p class="text-expense">{errorText(query.error)}</p>
{:else}
  <p class={muted}>Loading link type</p>
{/if}
