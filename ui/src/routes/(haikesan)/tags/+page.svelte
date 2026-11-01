<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate, lists } from "#lib/api/lists.js";
  import type { Item, Tag, TransactionGroup } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import { periodPath } from "#lib/components/budgets/period-path.svelte.js";
  import ListMenu from "#lib/components/categories/ListMenu.svelte";
  import MoneyList from "#lib/components/categories/MoneyList.svelte";
  import { list, rows as splitRows } from "#lib/components/categories/sums.js";
  import { setParam } from "#lib/components/categories/url.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { deleteTag, usage } from "#lib/components/tags/actions.js";
  import ConvertField from "#lib/components/tags/ConvertField.svelte";
  import Duplicates from "#lib/components/tags/Duplicates.svelte";
  import {
    type Finding,
    findings,
    leafOf,
    rankOf,
    SECTIONS,
  } from "#lib/components/tags/findings.js";
  import MergeField from "#lib/components/tags/MergeField.svelte";
  import RenameField from "#lib/components/tags/RenameField.svelte";
  import {
    buildTree,
    duplicates,
    flatNodes,
    flatten,
    type TagNode,
    tagStats,
  } from "#lib/components/tags/tree.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { formatDate } from "#lib/format.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import type { Binding } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { signedAmount } from "#lib/transactions/split.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const ARM_MS = 3000;

  const tags = createQuery(() => lists.tags());
  const groups = createQuery(() => ({
    enabled: period.ready,
    queryFn: () =>
      all<TransactionGroup>("/v1/transactions", {
        end: period.end,
        start: period.start,
        type: "all",
      }),
    queryKey: ["tags-period", period.start, period.end],
  }));

  const flat = $derived(page.url.searchParams.get("view") === "flat");
  const cleanup = $derived(page.url.searchParams.get("mode") === "cleanup");
  const filter = $derived(page.url.searchParams.get("q") ?? "");

  const counts = createQuery(() => ({
    enabled: cleanup && Boolean(tags.data),
    placeholderData: keepPreviousData,
    queryFn: () => usage(tags.data ?? []),
    queryKey: ["tags-usage", (tags.data ?? []).map((t) => t.id).join(",")],
  }));
  const categories = createQuery(() => lists.categories());
  const bills = createQuery(() => lists.bills());
  const expenses = createQuery(() => ({
    ...lists.accounts("expense"),
    enabled: cleanup,
  }));
  const found = $derived(
    cleanup
      ? findings(tags.data ?? [], {
          accounts: expenses.data ?? [],
          bills: bills.data ?? [],
          categories: categories.data ?? [],
          usage: counts.data,
        })
      : new Map<string, Finding>()
  );

  const items = $derived(splitRows(groups.data ?? []));
  const stats = $derived(tagStats(items, !(flat || filter)));
  const rank = (node: TagNode) => rankOf(found.get(node.tag?.id ?? ""));
  const nodes = $derived.by(() => {
    const source = tags.data ?? [];
    const matched = filter
      ? fuzzyFilter(source, filter, (t) => t.attributes.tag, source.length)
      : source;
    if (cleanup) {
      return flatNodes(matched).sort((a, b) => rank(a) - rank(b));
    }
    if (filter || flat) {
      return flatNodes(matched);
    }
    return flatten(buildTree(source));
  });
  const sectionOf = (i: number) =>
    found.get(nodes[i]?.tag?.id ?? "")?.section ?? "rest";
  const sectionSize = $derived(
    nodes.reduce<Record<string, number>>((sizes, _, i) => {
      sizes[sectionOf(i)] = (sizes[sectionOf(i)] ?? 0) + 1;
      return sizes;
    }, {})
  );
  const clusters = $derived(cleanup ? duplicates(tags.data ?? []) : []);

  let editing = $state<{
    path: string;
    mode: "rename" | "merge" | "category" | "bill";
  } | null>(null);
  let armed = $state<string | null>(null);
  let armTimer: ReturnType<typeof setTimeout> | undefined;
  let rowStatus = $state<Record<string, string>>({});
  let filterInput = $state<HTMLInputElement>();
  let createInput = $state<HTMLInputElement>();
  let newTag = $state("");
  let creating = $state(false);
  let createError = $state("");

  const showHref = (node: TagNode) =>
    node.tag
      ? periodPath(`/tags/show/${node.tag.id}`, period.start, period.end)
      : `/search?search=${encodeURIComponent(`tag_starts:"${node.path}/"`)}`;

  function rename(node: TagNode | undefined) {
    if (node) {
      armed = null;
      editing = { mode: "rename", path: node.path };
    }
  }

  function merge(node: TagNode | undefined) {
    if (node?.tag) {
      armed = null;
      editing = { mode: "merge", path: node.path };
    }
  }

  function convert(node: TagNode | undefined, mode: "category" | "bill") {
    if (node?.tag) {
      armed = null;
      editing = { mode, path: node.path };
    }
  }

  function choicesFor(mode: "category" | "bill") {
    if (mode === "category") {
      return (categories.data ?? []).map((c) => ({
        id: c.id,
        name: c.attributes.name,
      }));
    }
    return (bills.data ?? []).map((b) => ({
      id: b.id,
      name: b.attributes.name ?? "",
    }));
  }

  function matches(finding: Finding | undefined) {
    return [
      finding?.category && {
        href: `/categories/show/${finding.category.id}`,
        kind: "category",
        name: finding.category.attributes.name,
      },
      finding?.account && {
        href: `/accounts/show/${finding.account.id}`,
        kind: "account",
        name: finding.account.attributes.name,
      },
      finding?.bill && {
        href: `/subscriptions/show/${finding.bill.id}`,
        kind: "subscription",
        name: finding.bill.attributes.name,
      },
    ].filter((match) => match !== undefined);
  }

  function initialFor(tag: Item<Tag>, mode: "category" | "bill") {
    const finding = found.get(tag.id);
    const match =
      mode === "bill"
        ? finding?.bill?.attributes.name
        : finding?.category?.attributes.name;
    return match ?? leafOf(tag.attributes.tag);
  }

  async function remove(node: TagNode) {
    if (!node.tag) {
      return;
    }
    rowStatus[node.path] = "Deleting";
    try {
      await deleteTag(node.tag);
      await invalidate();
    } catch (failure) {
      rowStatus[node.path] =
        failure instanceof Error ? failure.message : String(failure);
    }
  }

  function pressDelete(node: TagNode | undefined) {
    if (!node?.tag) {
      return;
    }
    clearTimeout(armTimer);
    if (armed === node.path) {
      armed = null;
      remove(node);
      return;
    }
    armed = node.path;
    armTimer = setTimeout(() => (armed = null), ARM_MS);
  }

  async function create(event: SubmitEvent) {
    event.preventDefault();
    const tag = newTag.trim();
    if (creating) {
      return;
    }
    if (!tag) {
      createError = "Type a tag first";
      createInput?.focus();
      return;
    }
    creating = true;
    createError = "";
    try {
      await api("/v1/tags", { body: { tag }, method: "POST" });
      newTag = "";
      await invalidate();
    } catch (failure) {
      createError = failure instanceof Error ? failure.message : "Failed";
    } finally {
      creating = false;
    }
  }

  const nav: ListNav<TagNode> = new ListNav<TagNode>({
    edit: (node) => node.tag && goto(`/tags/edit/${node.tag.id}`),
    extra: (): Binding[] => [
      {
        group: "Tags",
        keys: "r",
        label: "Rename tag",
        run: () => rename(nav.current),
      },
      {
        group: "Tags",
        keys: "m",
        label: "Merge tag into another",
        run: () => merge(nav.current),
      },
      {
        group: "Tags",
        keys: "s c",
        label: "Move tag's transactions to a category",
        run: () => convert(nav.current, "category"),
      },
      {
        group: "Tags",
        keys: "s s",
        label: "Link tag's transactions to a subscription",
        run: () => convert(nav.current, "bill"),
      },
      {
        group: "Tags",
        keys: "d d",
        label: "Delete tag (twice)",
        run: () => pressDelete(nav.current),
      },
      {
        group: "Tags",
        keys: "/",
        label: "Filter tags",
        run: () => filterInput?.focus(),
      },
      {
        group: "Tags",
        keys: "c",
        label: "New tag",
        run: () => createInput?.focus(),
      },
      {
        group: "Tags",
        keys: "v",
        label: "Tree or flat view",
        run: () => setParam("view", flat ? "" : "flat"),
      },
      {
        group: "Tags",
        keys: "C",
        label: "Clean-up mode",
        run: () => setParam("mode", cleanup ? "" : "cleanup"),
      },
    ],
    id: "tags",
    items: () => nodes,
    key: (node) => node.path,
    open: (node) => goto(showHref(node)),
  });
  nav.use();
</script>

{#snippet reason(
  finding: Finding | undefined
)}
  <span class="flex flex-wrap items-baseline gap-x-2">
    {#each matches(finding) as match (match.kind)}
      <span
        >{match.kind}
        <a class="text-brand hover:underline" href={match.href}
          >{match.name}</a
        ></span
      >
    {/each}
    {#if finding?.sample}
      {@const split = finding.sample.attributes.transactions[0]}
      {@const money = signedAmount(split)}
      <a
        class="max-w-64 truncate text-cladd-fg hover:underline"
        href="/transactions/show/{finding.sample.id}"
        >{split.description}</a
      >
      <Amount
        amount={money.amount}
        code={money.code}
        decimals={money.decimals}
        symbol={money.symbol}
        tone={money.tone}
      />
      <span class="num">{formatDate(split.date.slice(0, 10))}</span>
    {/if}
  </span>
{/snippet}

<PageHeader crumbs={[{ label: "Tags" }]} title="Tags">
  {#snippet actions()}
    <Button href="/tags/create" size="sm" variant="outline">
      <Plus />Create a tag
    </Button>
  {/snippet}
</PageHeader>

{#if tags.isError}
  <p class="text-expense">Could not load tags: {tags.error.message}</p>
{/if}

<div class="flex flex-col gap-4">
  {#if cleanup}
    <Duplicates {clusters} counts={counts.data?.counts ?? new Map()} />
  {/if}

  <Box body="p-0" title="Tags">
    {#snippet tools()}
      <div class="flex flex-wrap items-center gap-2">
        {#if !(flat || filter || cleanup)}
          <span class="hidden text-[12px] text-cladd-fg-soft md:inline"
            >parent rows include sub-tags</span
          >
        {/if}
        <div
          class="flex rounded-cladd-sm bg-cladd-surface-next p-0.5 text-[12px] {cleanup
            ? "hidden"
            : ""}"
        >
          <button
            aria-pressed={!flat}
            class="rounded-cladd-xs px-2 py-0.5 {flat
              ? "text-cladd-fg-soft"
              : "cladd-surface font-semibold"}"
            onclick={() => setParam("view", "")}
            title="Tree view (v)"
            type="button"
          >
            Tree
          </button>
          <button
            aria-pressed={flat}
            class="rounded-cladd-xs px-2 py-0.5 {flat
              ? "cladd-surface font-semibold"
              : "text-cladd-fg-soft"}"
            onclick={() => setParam("view", "flat")}
            title="Flat view (v)"
            type="button"
          >
            Flat
          </button>
        </div>
        <button
          aria-pressed={cleanup}
          class="rounded-cladd-sm px-2 py-1 text-[12px] {cleanup
            ? "bg-row-selected font-semibold"
            : "text-cladd-fg-soft hover:bg-row-hover"}"
          onclick={() => setParam("mode", cleanup ? "" : "cleanup")}
          title="Clean-up mode (C)"
          type="button"
        >
          Clean up
        </button>
        <input
          aria-label="Filter tags"
          class="cladd-cut cladd-focusable-input h-7 w-32 rounded-cladd-sm px-2 text-[12px] sm:w-44"
          oninput={(event) => setParam("q", event.currentTarget.value)}
          onkeydown={(event) => {
            if (event.key === "Enter" || event.key === "ArrowDown") {
              event.preventDefault();
              event.currentTarget.blur();
              nav.move(0);
            }
          }}
          placeholder="Filter (/)"
          value={filter}
          bind:this={filterInput}
        >
      </div>
    {/snippet}
    <div class="overflow-x-auto">
      <table class="w-full min-w-[44rem] text-[13px]">
        <thead>
          <tr
            class="h-8 border-cladd-outline border-b text-left text-[12px] text-cladd-fg-soft"
          >
            <th class="px-3 font-medium">Tag</th>
            <th class="px-3 text-right font-medium">Transactions</th>
            <th class="px-3 text-right font-medium">Spent</th>
            <th class="px-3 text-right font-medium">Earned</th>
            {#if cleanup}
              <th class="px-3 text-right font-medium">
                {counts.isFetching ? "Counting" : "All time"}
              </th>
            {/if}
            {#if cleanup}
              <th class="px-3 font-medium">Reason</th>
            {:else}
              <th class="hidden px-3 font-medium md:table-cell">Date</th>
              <th class="hidden px-3 font-medium lg:table-cell">Description</th>
            {/if}
          </tr>
        </thead>
        <ListMenu
          deleteLabel="Delete tag"
          items={() => [
            {
              keys: "Enter",
              label: "Show",
              run: () => nav.current && goto(showHref(nav.current)),
            },
            {
              keys: "e",
              label: "Edit tag",
              run: () =>
                nav.current?.tag && goto(`/tags/edit/${nav.current.tag.id}`),
            },
            { keys: "r", label: "Rename", run: () => rename(nav.current) },
            {
              keys: "m",
              label: "Merge into another tag",
              run: () => merge(nav.current),
            },
            {
              keys: "s c",
              label: "Move to a category",
              run: () => convert(nav.current, "category"),
            },
            {
              keys: "s s",
              label: "Link to a subscription",
              run: () => convert(nav.current, "bill"),
            },
            {
              label: "Open in old UI",
              run: () =>
                nav.current?.tag &&
                location.assign(
                  oldUiUrl(`${location.origin}/tags/show/${nav.current.tag.id}`)
                ),
            },
          ]}
          ondelete={() => nav.current && remove(nav.current)}
        >
          {#snippet children(
            props
          )}
            <tbody {...props}>
              {#each nodes as node, i (node.path)}
                {@const stat = stats.get(node.path)}
                {@const total = node.tag
                  ? counts.data?.counts.get(node.tag.id)
                  : undefined}
                {@const finding = found.get(node.tag?.id ?? "")}
                {#if cleanup && (i === 0 || sectionOf(i - 1) !== sectionOf(i))}
                  <tr
                    class="h-7 border-cladd-outline border-b bg-cladd-surface-next"
                  >
                    <td
                      class="px-3 font-semibold text-[12px] text-cladd-fg-soft"
                      colspan="7"
                    >
                      {SECTIONS[sectionOf(i)]}
                      <span class="num ml-1 font-normal"
                        >{sectionSize[sectionOf(i)]}</span
                      >
                    </td>
                  </tr>
                {/if}
                <tr
                  class="h-7 border-cladd-outline border-b last:border-b-0 {nav.cursor ===
                  i
                    ? "bg-row-cursor"
                    : "hover:bg-row-hover"}"
                  id={nav.rowId(i)}
                  onclick={(event) => nav.click(i, event)}
                  oncontextmenu={() => (nav.cursor = i)}
                >
                  <td
                    class="px-3"
                    style:padding-left="{0.75 + node.depth * 1.25}rem"
                  >
                    {#if editing?.path === node.path &&
                      editing.mode === "rename"}
                      <RenameField
                        {node}
                        ondone={() => (editing = null)}
                        tags={tags.data ?? []}
                      />
                    {:else if editing?.path === node.path &&
                      editing.mode === "merge" &&
                      node.tag}
                      <MergeField
                        ondone={() => (editing = null)}
                        tag={node.tag}
                        tags={tags.data ?? []}
                      />
                    {:else if editing?.path === node.path &&
                      (editing.mode === "category" ||
                        editing.mode === "bill") &&
                      node.tag}
                      <ConvertField
                        choices={choicesFor(editing.mode)}
                        initial={initialFor(node.tag, editing.mode)}
                        kind={editing.mode}
                        ondone={(status) => {
                          editing = null;
                          if (status) {
                            rowStatus[node.path] = status;
                          }
                        }}
                        tag={node.tag}
                      />
                    {:else}
                      <a
                        class="hover:underline {node.tag
                          ? "text-cladd-fg"
                          : "text-cladd-fg-soft italic"}"
                        href={showHref(node)}
                      >
                        {node.name}
                      </a>
                      {#if !node.tag}
                        <span class="ml-1 text-[11px] text-cladd-fg-softer"
                          >no tag of its own</span
                        >
                      {/if}
                      {#if armed === node.path}
                        <span class="ml-2 text-[12px] text-expense"
                          >Press d d again to delete</span
                        >
                      {:else if rowStatus[node.path]}
                        <span class="ml-2 text-[12px] text-cladd-fg-soft"
                          >{rowStatus[node.path]}</span
                        >
                      {/if}
                    {/if}
                  </td>
                  <td
                    class="num px-3 text-right {node.children.length > 0 &&
                    !flat
                      ? "font-semibold"
                      : ""}"
                  >
                    {stat?.count || ""}
                  </td>
                  <td class="px-3 text-right">
                    <MoneyList sums={list(stat?.spent ?? {})} />
                  </td>
                  <td class="px-3 text-right">
                    <MoneyList sums={list(stat?.earned ?? {})} />
                  </td>
                  {#if cleanup}
                    <td class="num px-3 text-right">
                      {#if total === 0}
                        <span class="text-warn">unused</span>
                      {:else}
                        {total ?? ""}
                      {/if}
                    </td>
                  {/if}
                  {#if cleanup}
                    <td class="px-3 text-[12px] text-cladd-fg-soft">
                      {@render reason(finding)}
                    </td>
                  {:else}
                    <td
                      class="num hidden px-3 text-[12px] text-cladd-fg-soft md:table-cell"
                    >
                      {node.tag?.attributes.date
                        ? formatDate(node.tag.attributes.date)
                        : ""}
                    </td>
                    <td
                      class="hidden max-w-80 truncate px-3 text-[12px] text-cladd-fg-soft lg:table-cell"
                    >
                      {node.tag?.attributes.description ?? ""}
                    </td>
                  {/if}
                </tr>
              {:else}
                {#if !tags.isPending}
                  <tr>
                    <td class="px-3 py-3 text-cladd-fg-soft" colspan="7">
                      {filter ? "No tag matches." : "No tags yet."}
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          {/snippet}
        </ListMenu>
      </table>
    </div>
    {#snippet footer()}
      <form class="flex flex-1 flex-wrap items-center gap-2" onsubmit={create}>
        <input
          aria-label="New tag"
          class="cladd-cut cladd-focusable-input h-7 w-64 rounded-cladd-sm px-2 text-[13px]"
          oninput={() => (createError = "")}
          placeholder="New tag, parent/child works (c)"
          bind:this={createInput}
          bind:value={newTag}
        >
        <Button disabled={creating} size="sm" type="submit">Create</Button>
        {#if createError}
          <span class="text-expense">{createError}</span>
        {/if}
        <span
          class="ml-auto flex flex-wrap gap-x-3 text-[12px] text-cladd-fg-soft"
        >
          <span><span class="kbd">r</span> rename</span>
          <span><span class="kbd">m</span> merge</span>
          <span
            ><span class="kbd">s</span><span class="kbd">c</span>
            to category</span
          >
          <span
            ><span class="kbd">s</span><span class="kbd">s</span>
            to subscription</span
          >
          <span
            ><span class="kbd">d</span><span class="kbd">d</span>
            delete</span
          >
        </span>
      </form>
    {/snippet}
  </Box>
</div>
