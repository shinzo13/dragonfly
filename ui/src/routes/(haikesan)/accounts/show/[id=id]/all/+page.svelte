<script lang="ts">
  import AccountShow from "#lib/components/accounts/AccountShow.svelte";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
</script>

{#key id}
  <AccountShow everything {id} />
{/key}
