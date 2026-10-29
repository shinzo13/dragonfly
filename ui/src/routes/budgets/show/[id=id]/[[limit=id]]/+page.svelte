<script lang="ts">
  import ShowBudget from "#lib/components/budgets/ShowBudget.svelte";
  import { page } from "$app/state";
</script>

{#key page.params.id}
  <ShowBudget id={page.params.id ?? ""} limitId={page.params.limit} />
{/key}
