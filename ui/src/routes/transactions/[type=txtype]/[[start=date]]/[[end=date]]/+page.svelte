<script lang="ts">
  import { today } from "#lib/dates.js";
  import { page } from "$app/state";
  import ListPage from "../../ListPage.svelte";

  const start = $derived(page.params.start);
  const end = $derived(page.params.end ?? (start ? today() : undefined));
</script>

<ListPage {end} param={page.params.type ?? "all"} {start} />
