<script lang="ts">
  import ShowTag from "#lib/components/tags/ShowTag.svelte";
  import { page } from "$app/state";
</script>

{#key page.params.tag}
  <ShowTag everything param={page.params.tag ?? ""} />
{/key}
