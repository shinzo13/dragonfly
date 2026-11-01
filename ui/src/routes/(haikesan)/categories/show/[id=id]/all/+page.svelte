<script lang="ts">
  import ShowCategory from "#lib/components/categories/ShowCategory.svelte";
  import { page } from "$app/state";
</script>

{#key page.params.id}
  <ShowCategory everything id={page.params.id ?? ""} />
{/key}
