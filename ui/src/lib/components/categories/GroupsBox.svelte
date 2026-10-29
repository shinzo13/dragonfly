<script lang="ts">
  import type { Snippet } from "svelte";
  import Box from "#lib/components/Box.svelte";
  import Pager from "#lib/components/transactions/Pager.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import { session } from "#lib/session.svelte.js";
  import type { Group } from "#lib/transactions/split.js";
  import { page } from "$app/state";

  let {
    groups,
    title,
    loading = false,
    empty = "No transactions.",
    links,
  }: {
    groups: Group[];
    title: string;
    loading?: boolean;
    empty?: string;
    links?: Snippet;
  } = $props();

  const size = $derived(session.pageSize);
  const pages = $derived(Math.max(1, Math.ceil(groups.length / size)));
  const current = $derived(
    Math.min(pages, Math.max(1, Number(page.url.searchParams.get("page")) || 1))
  );
  const slice = $derived(groups.slice((current - 1) * size, current * size));

  function href(n: number) {
    const url = new URL(page.url.href);
    url.searchParams.set("page", String(n));
    return url.pathname + url.search;
  }
</script>

<Box body="p-0" {title}>
  {#snippet tools()}
    <span class="num text-[12px] text-cladd-fg-soft">{groups.length}</span>
  {/snippet}
  <TransactionTable {empty} groups={slice} {loading} />
  {#snippet footer()}
    {@render links?.()}
    <div class="ml-auto"><Pager {href} keys page={current} {pages} /></div>
  {/snippet}
</Box>
