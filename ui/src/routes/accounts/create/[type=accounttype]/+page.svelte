<script lang="ts">
  import type { AccountType } from "#lib/api/types.js";
  import AccountForm from "#lib/components/accounts/AccountForm.svelte";
  import {
    indexUrl,
    TYPE_ONE,
    TYPE_TITLE,
  } from "#lib/components/accounts/links.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { page } from "$app/state";

  const type = $derived(page.params.type as AccountType);
</script>

<PageHeader
  crumbs={[
    { href: indexUrl(type), label: TYPE_TITLE[type] },
    { label: `Create a new ${TYPE_ONE[type]}` },
  ]}
  title="Create a new {TYPE_ONE[type]}"
/>

{#key type}
  <AccountForm {type} />
{/key}
