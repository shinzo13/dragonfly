<script lang="ts">
  import ShowTag from "#lib/components/tags/ShowTag.svelte";
  import { page } from "$app/state";
</script>

{#key page.params.tag}
  <ShowTag param={page.params.tag ?? ""} />
{/key}
