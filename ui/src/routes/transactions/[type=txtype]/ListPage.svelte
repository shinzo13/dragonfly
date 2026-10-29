<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { tick, untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Page, TransactionGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import FilterBar from "#lib/components/transactions/FilterBar.svelte";
  import Pager from "#lib/components/transactions/Pager.svelte";
  import PeriodSummary from "#lib/components/transactions/PeriodSummary.svelte";
  import Periods from "#lib/components/transactions/Periods.svelte";
  import QueryInput from "#lib/components/transactions/QueryInput.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import { formatDate } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import {
    accountIdOf,
    bySection,
    type Cluster,
    duplicates,
    FACETS,
    type FacetId,
    isFiltered,
    narrow,
    type Section,
    searchQuery,
    sectionOf,
    splitTest,
    yearRange,
  } from "#lib/transactions/ledger.js";
  import { LedgerView } from "#lib/transactions/ledger-view.svelte.js";
  import {
    createType,
    type Group,
    LIST_TITLE,
    listPath,
    listType,
  } from "#lib/transactions/split.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const SUBTITLE: Record<string, string> = {
    all: "All transactions",
    deposit: "All revenue and income",
    transfer: "All transfers",
    withdrawal: "All expenses",
  };
  const WITHDRAWAL_ONLY = new Set<FacetId>(["budget", "bill"]);
  const TOOL =
    "inline-flex h-7 items-center gap-1.5 rounded-cladd-sm px-2 text-[12px] text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg";

  let {
    param,
    start,
    end,
    everything = false,
  }: {
    param: string;
    start?: string;
    end?: string;
    everything?: boolean;
  } = $props();

  let query = $state("");
  let input = $state<HTMLInputElement>();
  let lastRange = "";

  const view = new LedgerView();
  const type = $derived(listType(param));
  const pageNo = $derived(
    Math.max(1, Number(page.url.searchParams.get("page")) || 1)
  );
  const year = $derived(page.url.searchParams.get("span") === "year");
  const range = $derived.by(() => {
    if (everything) {
      return null;
    }
    return year
      ? yearRange(period.end)
      : { end: period.end, start: period.start };
  });

  $effect(() => {
    if (period.ready && start && end) {
      const fromPath = { end, start };
      untrack(() => period.set(fromPath));
    }
  });

  $effect(() => {
    if (!period.ready) {
      return;
    }
    const key = `${period.start}|${period.end}`;
    untrack(() => {
      const moved = lastRange !== "" && lastRange !== key;
      lastRange = key;
      if (!moved || everything) {
        return;
      }
      const url = new URL(page.url.href);
      url.searchParams.delete("page");
      url.searchParams.set("start", period.start);
      url.searchParams.set("end", period.end);
      if (start && end && (start !== period.start || end !== period.end)) {
        url.pathname = listPath(type);
      }
      if (url.href !== page.url.href) {
        tick().then(() => goto(url, { replace: true, reset: false }));
      }
    });
  });

  const list = createQuery(() => ({
    enabled: everything,
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<Page<TransactionGroup>>("/v1/transactions", {
        query: { limit: session.pageSize, page: pageNo, type },
      }),
    queryKey: ["transactions", type, pageNo, session.pageSize],
  }));

  const ledger = createQuery(() => ({
    enabled: !everything && period.ready,
    placeholderData: keepPreviousData,
    queryFn: () =>
      all<TransactionGroup>("/v1/transactions", {
        end: range?.end,
        start: range?.start,
        type,
      }),
    queryKey: ["transactions-ledger", type, range?.start, range?.end],
    refetchOnWindowFocus: "always" as const,
  }));

  const groups = $derived(ledger.data ?? []);
  const filters = $derived(view.filters);
  const filtered = $derived(isFiltered(filters));
  const clusters = $derived(duplicates(groups, view.ignored));
  const clusterCount = $derived(new Set(clusters.values()).size);
  const keep = $derived(
    filters.dupes ? (group: Group) => clusters.has(group.id) : () => true
  );
  const matched = $derived(narrow(groups, splitTest(filters), keep));
  const section = $derived.by<((group: Group) => Section) | undefined>(() => {
    if (filters.dupes) {
      return (group) => clusterSection(clusters.get(group.id));
    }
    const by = filters.group;
    return by ? (group) => sectionOf(by, group) : undefined;
  });
  const ordered = $derived(
    section && filters.group !== "day" ? bySection(matched, section) : matched
  );
  const paged = $derived(!(filtered || section));
  const pages = $derived(
    paged ? Math.max(1, Math.ceil(matched.length / session.pageSize)) : 1
  );
  const visible = $derived(
    paged
      ? ordered.slice(
          (pageNo - 1) * session.pageSize,
          pageNo * session.pageSize
        )
      : ordered
  );
  const facetIds = $derived(
    FACETS.map((facet) => facet.id).filter(
      (id) =>
        (id !== "kind" || type === "all") &&
        !(WITHDRAWAL_ONLY.has(id) && ["deposit", "transfer"].includes(type))
    )
  );
  const narrowedTo = $derived.by(() => {
    const accounts = filters.facets.account ?? [];
    return accounts.length === 1 ? accountIdOf(groups, accounts[0]) : undefined;
  });
  const subtitle = $derived(
    range
      ? `${SUBTITLE[type]} between ${formatDate(range.start)} and ${formatDate(range.end)}`
      : SUBTITLE[type]
  );

  function clusterSection(cluster: Cluster | undefined): Section {
    if (!cluster) {
      return { key: "", label: "" };
    }
    const [newest] = cluster.groups;
    return {
      actions: [
        {
          confirm: true,
          label: "Delete newer",
          run: async () => {
            await api(`/v1/transactions/${newest.id}`, { method: "DELETE" });
            await invalidate();
          },
        },
        { label: "Not duplicates", run: () => view.ignore(cluster.id) },
      ],
      key: cluster.id,
      label: cluster.label,
    };
  }

  function pageHref(n: number) {
    const url = new URL(page.url.href);
    url.searchParams.set("page", String(n));
    return url.pathname + url.search;
  }

  function search(text: string) {
    goto(`/search?search=${encodeURIComponent(text)}`);
  }

  function toggleYear() {
    const url = new URL(page.url.href);
    if (year) {
      url.searchParams.delete("span");
    } else {
      url.searchParams.set("span", "year");
    }
    url.searchParams.delete("page");
    goto(url, { replace: true, reset: false });
  }

  useKeys(() =>
    everything
      ? [
          {
            group: "Global",
            keys: "/",
            label: "Search in this list",
            run: () => {
              if (!query && type !== "all") {
                query = `type:${type} `;
              }
              input?.focus();
              input?.setSelectionRange(query.length, query.length);
            },
          },
        ]
      : [
          {
            group: "Filter",
            keys: "Y",
            label: year ? "Back to the period" : "Load the last 12 months",
            run: toggleYear,
          },
        ]
  );
</script>

<PageHeader
  crumbs={[
    { href: "/transactions/all", label: "Transactions" },
    { label: LIST_TITLE[type] ?? type },
  ]}
  {subtitle}
  title="Transactions"
>
  {#snippet actions()}
    {#if everything}
      <QueryInput
        class="w-80 max-md:w-full"
        id="list-query"
        onsubmit={search}
        placeholder="Search, press / to start"
        bind:input
        bind:value={query}
      />
    {/if}
    <Button
      color="green"
      href={`/transactions/create/${createType(type)}`}
      size="sm"
    >
      <Plus />
      Create a new transaction
    </Button>
  {/snippet}
</PageHeader>

{#if !everything}
  <PeriodSummary groups={matched} loading={ledger.isPending} {type} />
{/if}

<div
  class="grid items-start gap-4 min-[1600px]:grid-cols-[minmax(0,1fr)_13rem]"
>
  <Box body="p-0" title={LIST_TITLE[type] ?? "Transactions"}>
    {#snippet tools()}
      {#if !everything}
        <button class={TOOL} onclick={toggleYear} type="button">
          {year ? "Back to the period" : "Load year"}
          <span class="kbd max-md:hidden">Y</span>
        </button>
      {/if}
      <span class="max-sm:hidden">
        {#if everything}
          <Pager
            href={pageHref}
            keys
            page={pageNo}
            pages={list.data?.meta.pagination?.total_pages ?? 1}
          />
        {:else if paged}
          <Pager href={pageHref} keys page={pageNo} {pages} />
        {/if}
      </span>
    {/snippet}
    {#if everything}
      <TransactionTable
        empty="No transactions."
        groups={list.data?.data ?? []}
        id="tx-list"
        loading={list.isFetching}
      />
    {:else}
      <FilterBar
        duplicates={clusterCount}
        {groups}
        ids={facetIds}
        {keep}
        onsearch={() => search(searchQuery(filters, type, range))}
        shown={matched.length}
        total={groups.length}
        {view}
      />
      <TransactionTable
        context={{ accountId: narrowedTo }}
        empty={filtered
          ? "Nothing matches this filter."
          : "No transactions in this period."}
        groups={visible}
        id="tx-list"
        loading={ledger.isPending || ledger.isPlaceholderData}
        {section}
      />
    {/if}
    {#snippet footer()}
      {#if everything}
        <a class="text-brand hover:underline" href={listPath(type)}
          >Show the current period and overview</a
        >
      {:else}
        <a class="text-brand hover:underline" href={`${listPath(type)}/all`}
          >Show all transactions without grouping them by date</a
        >
      {/if}
      <span class="ml-auto">
        {#if everything}
          <Pager
            href={pageHref}
            page={pageNo}
            pages={list.data?.meta.pagination?.total_pages ?? 1}
          />
        {:else if paged}
          <Pager href={pageHref} page={pageNo} {pages} />
        {/if}
      </span>
    {/snippet}
  </Box>
  {#if !everything}
    <Periods {type} />
  {/if}
</div>
