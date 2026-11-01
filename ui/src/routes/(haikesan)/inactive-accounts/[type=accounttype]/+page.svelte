<script lang="ts">
  import type { AccountType } from "#lib/api/types.js";
  import AccountsIndex from "#lib/components/accounts/AccountsIndex.svelte";
  import { page } from "$app/state";

  const type = $derived(page.params.type as AccountType);
</script>

{#key type}
  <AccountsIndex active={false} {type} />
{/key}
