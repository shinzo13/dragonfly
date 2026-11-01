<script lang="ts">
  import type { AccountType } from "#lib/api/types.js";
  import AccountsIndex from "#lib/components/accounts/AccountsIndex.svelte";
  import Ledger from "#lib/components/accounts/Ledger.svelte";
  import Merchants from "#lib/components/accounts/Merchants.svelte";
  import { page } from "$app/state";

  const type = $derived(page.params.type as AccountType);
</script>

{#key type}
  {#if type === "liabilities"}
    <Ledger />
  {:else if type === "expense" || type === "revenue"}
    <Merchants kind={type} />
  {:else}
    <AccountsIndex {type} />
  {/if}
{/key}
