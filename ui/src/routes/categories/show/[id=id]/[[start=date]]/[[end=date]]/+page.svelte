<script lang="ts">
  import ShowCategory from "#lib/components/categories/ShowCategory.svelte";
  import { page } from "$app/state";
</script>

{#key page.params.id}
  <ShowCategory id={page.params.id ?? ""} />
{/key}
