<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { Page, TransactionGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Pager from "#lib/components/transactions/Pager.svelte";
  import QueryInput from "#lib/components/transactions/QueryInput.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import { formatNumber } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { explain, operatorsQuery } from "#lib/transactions/query.js";
  import { searches } from "#lib/transactions/searches.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const MS = 1000;
  const EXAMPLES = [
    "category_is:",
    "budget_is:",
    "tag_is:",
    "amount_more:",
    "date_after:",
    "has_no_category:true",
    "notes_contains:",
    "source_account_is:",
  ];

  let input = $state<HTMLInputElement>();
  let seconds = $state(0);
  let pinNote = $state({ query: "", text: "" });

  const query = $derived(page.url.searchParams.get("search")?.trim() ?? "");
  const pageNo = $derived(
    Math.max(1, Number(page.url.searchParams.get("page")) || 1)
  );
  let draft = $derived(query);

  const operators = createQuery(() => ({
    ...operatorsQuery(),
    enabled: query !== "",
  }));

  const results = createQuery(() => ({
    enabled: query !== "",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const started = performance.now();
      const data = await api<Page<TransactionGroup>>(
        "/v1/search/transactions",
        { query: { limit: session.pageSize, page: pageNo, query } }
      );
      seconds = (performance.now() - started) / MS;
      return data;
    },
    queryKey: ["search", query, pageNo, session.pageSize],
  }));

  const pagination = $derived(results.data?.meta.pagination);
  const pinned = $derived(searches.has(query));
  const explanation = $derived(explain(query, operators.data ?? []));

  function submit(text: string) {
    const url = new URL(page.url.href);
    url.searchParams.set("search", text);
    url.searchParams.delete("page");
    goto(url);
  }

  function pageHref(n: number) {
    const url = new URL(page.url.href);
    url.searchParams.set("page", String(n));
    return url.pathname + url.search;
  }

  function focus() {
    input?.focus();
    input?.setSelectionRange(draft.length, draft.length);
  }

  function insert(example: string) {
    draft = `${draft.trim()} ${example}`.trimStart();
    focus();
  }

  function togglePin() {
    if (!query) {
      focus();
      return;
    }
    const pin = searches.toggle(query);
    pinNote = {
      query,
      text: pin ? "Pinned, it is in the palette under Searches" : "Unpinned",
    };
  }

  $effect(() => {
    if (input && query === "") {
      input.focus();
    }
  });

  useKeys(() => [
    { group: "Global", keys: "/", label: "Focus search", run: focus },
    {
      group: "Search",
      keys: "P",
      label: pinned ? "Unpin this search" : "Pin this search",
      run: togglePin,
    },
  ]);
</script>

<PageHeader
  crumbs={[{ label: "Search" }]}
  subtitle={query ? `"${query}"` : undefined}
  title="Search"
/>

<Box class="mb-4" title="Search">
  <form
    class="flex flex-wrap items-center gap-2"
    onsubmit={(event) => {
      event.preventDefault();
      submit(draft.trim());
    }}
  >
    <label class="text-cladd-fg-soft" for="search-query">Query</label>
    <QueryInput
      class="min-w-64 flex-1"
      id="search-query"
      onsubmit={submit}
      bind:input
      bind:value={draft}
    />
    <Button size="sm" type="submit"><Search />Search</Button>
    {#if query}
      <Button onclick={togglePin} size="sm" variant="outline">
        {pinned ? "Unpin" : "Pin"} <span class="kbd max-sm:hidden">P</span>
      </Button>
      {#if pinNote.query === query && pinNote.text}
        <span class="text-[12px] text-cladd-fg-soft" role="status"
          >{pinNote.text}</span
        >
      {/if}
      <a
        class="text-[12px] text-brand hover:underline"
        data-sveltekit-reload
        href={`/rules/create?from_query=${encodeURIComponent(query)}`}
        >Create new rule from search query</a
      >
    {/if}
  </form>
  {#if query && explanation.length > 0}
    <p class="mt-2 text-cladd-fg-soft">
      Searching for: {explanation.join(", ")}
    </p>
  {:else if !query}
    <p class="mt-2 flex flex-wrap items-center gap-1.5 text-cladd-fg-soft">
      Type words to search descriptions, or operators:
      {#each EXAMPLES as example (example)}
        <button
          class="kbd cursor-pointer hover:text-cladd-fg"
          onclick={() => insert(example)}
          type="button"
        >
          {example}
        </button>
      {/each}
      <span>Tab or Enter accepts a suggestion.</span>
    </p>
    <p class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="text-cladd-fg-soft">Saved:</span>
      {#each searches.list() as saved (saved.query)}
        <a
          class="text-brand hover:underline"
          href="/search?search={encodeURIComponent(saved.query)}"
          onclick={(event) => {
            event.preventDefault();
            searches.open(saved);
          }}
          >{saved.label}</a
        >
      {/each}
    </p>
  {/if}
</Box>

{#if query}
  <Box body="p-0" title="Transactions">
    {#snippet tools()}
      {#if pagination && !results.isFetching}
        <span class="text-[12px] text-cladd-fg-soft max-sm:hidden"
          >Found {pagination.total}
          {pagination.total === 1 ? "transaction" : "transactions"}
          in
          {formatNumber(seconds, 2)}
          seconds</span
        >
      {:else if results.isFetching}
        <span class="text-[12px] text-cladd-fg-soft">Searching...</span>
      {/if}
      <span class="max-sm:hidden">
        <Pager
          href={pageHref}
          keys
          page={pageNo}
          pages={pagination?.total_pages ?? 1}
        />
      </span>
    {/snippet}
    {#if results.error}
      <p class="px-3 py-4 text-expense">
        An error occurred while searching: {results.error.message}
      </p>
    {:else}
      <TransactionTable
        empty="Nothing found. Check the query above."
        groups={results.data?.data ?? []}
        id="tx-search"
        loading={results.isFetching}
      />
    {/if}
    {#snippet footer()}
      <span class="ml-auto">
        <Pager
          href={pageHref}
          page={pageNo}
          pages={pagination?.total_pages ?? 1}
        />
      </span>
    {/snippet}
  </Box>
{/if}
