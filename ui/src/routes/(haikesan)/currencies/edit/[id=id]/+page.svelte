<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { errorText } from "#lib/components/misc/action.svelte.js";
  import { misc } from "#lib/components/misc/queries.js";
  import { muted } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";
  import CurrencyForm from "../../CurrencyForm.svelte";

  const query = createQuery(misc.currencies);
  const item = $derived(query.data?.find((c) => c.id === page.params.id));
  const title = $derived(
    item ? `Edit currency "${item.attributes.name}"` : "Edit currency"
  );
</script>

<PageHeader
  crumbs={[{ href: "/currencies", label: "Currencies" }, { label: title }]}
  {title}
/>
{#if item}
  {#key item.id}
    <CurrencyForm {item} />
  {/key}
{:else if query.error}
  <p class="text-expense">{errorText(query.error)}</p>
{:else if query.isPending}
  <p class={muted}>Loading currency</p>
{:else}
  <p class={muted}>There is no currency with this id.</p>
{/if}
