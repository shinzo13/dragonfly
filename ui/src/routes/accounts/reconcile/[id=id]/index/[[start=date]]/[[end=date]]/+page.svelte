<script lang="ts">
  import Reconcile from "#lib/components/accounts/Reconcile.svelte";
  import { period } from "#lib/period.svelte.js";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
  const start = $derived(page.params.start ?? period.start);
  const end = $derived(page.params.end ?? period.end);
</script>

{#key `${id}-${start}-${end}`}
  <Reconcile {end} {id} {start} />
{/key}
