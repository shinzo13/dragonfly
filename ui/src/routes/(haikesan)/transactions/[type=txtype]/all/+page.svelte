<script lang="ts">
  import { page } from "$app/state";
  import ListPage from "../ListPage.svelte";
</script>

<ListPage everything param={page.params.type ?? "all"} />
