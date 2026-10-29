<script lang="ts">
  import Box from "#lib/components/Box.svelte";
  import Pager from "#lib/components/transactions/Pager.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import { session } from "#lib/session.svelte.js";
  import type { Group } from "#lib/transactions/split.js";
  import { page } from "$app/state";

  let {
    groups,
    narrowed,
    onclear,
    loading = false,
    accountId,
    empty,
  }: {
    groups: Group[];
    narrowed: { groups: Group[]; label: string } | null;
    onclear: () => void;
    loading?: boolean;
    accountId?: string;
    empty: string;
  } = $props();

  const shown = $derived(narrowed?.groups ?? groups);
  const size = $derived(session.pageSize);
  const pages = $derived(Math.max(1, Math.ceil(shown.length / size)));
  const current = $derived(
    Math.min(pages, Math.max(1, Number(page.url.searchParams.get("page")) || 1))
  );
  const slice = $derived(shown.slice((current - 1) * size, current * size));

  function href(n: number) {
    const url = new URL(page.url.href);
    url.searchParams.set("page", String(n));
    return url.pathname + url.search;
  }
</script>

<Box body="p-0" title="Transactions">
  {#snippet tools()}
    {#if narrowed}
      <span class="text-[12px] text-cladd-fg-soft"
        ><span class="font-semibold text-cladd-fg">{narrowed.label}</span>
        <span class="num"
          >{narrowed.groups.length}
          of {groups.length}</span
        ></span
      >
      <button
        aria-label="Show all {groups.length}"
        class="kbd hover:text-cladd-fg"
        onclick={onclear}
        type="button"
      >
        Esc
      </button>
    {:else}
      <span class="num text-[12px] text-cladd-fg-soft">{groups.length}</span>
    {/if}
    <Pager {href} keys page={current} {pages} />
  {/snippet}
  <TransactionTable
    context={{ accountId }}
    {empty}
    groups={slice}
    id="dimension-tx"
    {loading}
  />
</Box>
