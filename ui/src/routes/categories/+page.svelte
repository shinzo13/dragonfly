<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Category, One } from "#lib/api/types.js";
  import { learnedCategories } from "#lib/budgets/map.js";
  import {
    placesOf,
    refreshExcept,
    withoutCategory,
  } from "#lib/budgets/triage.js";
  import Box from "#lib/components/Box.svelte";
  import { periodPath } from "#lib/components/budgets/period-path.svelte.js";
  import Triage from "#lib/components/budgets/Triage.svelte";
  import {
    type CategoryRow,
    loadCategoryPage,
  } from "#lib/components/categories/data.js";
  import ListMenu from "#lib/components/categories/ListMenu.svelte";
  import MoneyList from "#lib/components/categories/MoneyList.svelte";
  import { amountIn, type Sum } from "#lib/components/categories/sums.js";
  import { setParam } from "#lib/components/categories/url.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { formatDate, percent } from "#lib/format.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { type Binding, useKeys } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  type Sort = "name" | "spent" | "earned" | "activity";

  const SORTS: { key: Sort; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "spent", label: "Spent" },
    { key: "earned", label: "Earned" },
    { key: "activity", label: "Last activity" },
  ];

  const query = createQuery(() => ({
    enabled: period.ready,
    queryFn: () => loadCategoryPage(period.range, session.currencies),
    queryKey: ["categories-page", period.start, period.end],
  }));

  const sort = $derived<Sort>(
    (SORTS.find((s) => s.key === page.url.searchParams.get("sort"))?.key ??
      "name") as Sort
  );
  const filter = $derived(page.url.searchParams.get("q") ?? "");
  const primary = $derived(session.primary?.code ?? "");

  const main = $derived.by(() => {
    if (display.active) {
      return display.code;
    }
    const codes = new Set(
      (query.data?.rows ?? []).flatMap((r) => r.spent.map((s) => s.code))
    );
    return codes.has(primary) ? primary : ([...codes][0] ?? primary);
  });
  const measure = (sums: Sum[]) =>
    display.total(sums)?.amount ?? amountIn(sums, main);
  const totalSpent = $derived(
    -(
      (query.data?.rows ?? []).reduce((sum, r) => sum + measure(r.spent), 0) +
      measure(query.data?.spent ?? [])
    )
  );
  const share = (spent: number) => (totalSpent > 0 ? -spent / totalSpent : 0);

  const rows = $derived.by(() => {
    const source = query.data?.rows ?? [];
    const matched = filter
      ? fuzzyFilter(
          source,
          filter,
          (r) => r.item.attributes.name,
          source.length
        )
      : source;
    const sorted = [...matched];
    const name = (r: CategoryRow) => r.item.attributes.name;
    if (sort === "name") {
      sorted.sort((a, b) => name(a).localeCompare(name(b)));
    } else if (sort === "spent") {
      sorted.sort((a, b) => measure(a.spent) - measure(b.spent));
    } else if (sort === "earned") {
      sorted.sort((a, b) => measure(b.earned) - measure(a.earned));
    } else {
      sorted.sort((a, b) =>
        (b.item.attributes.last_activity ?? "").localeCompare(
          a.item.attributes.last_activity ?? ""
        )
      );
    }
    return sorted;
  });

  const noCategoryHref = $derived(
    periodPath("/categories/list/no-category", period.start, period.end)
  );

  const everything = $derived(page.url.searchParams.get("scope") === "all");
  const triageKey = $derived(
    everything
      ? ["category-triage", "all"]
      : ["category-triage", period.start, period.end]
  );
  const triage = createQuery(() => ({
    enabled: period.ready,
    queryFn: () => withoutCategory(everything ? null : period.range),
    queryKey: triageKey,
  }));
  const places = $derived(
    triage.data
      ? placesOf(
          triage.data,
          (split) =>
            (split.type === "withdrawal" || split.type === "deposit") &&
            !split.category_id
        )
      : []
  );
  const options = $derived(
    (query.data?.rows ?? [])
      .map((row) => ({ id: row.item.id, name: row.item.attributes.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  let triaging = $state(false);

  async function createCategory(name: string) {
    const made = await api<One<Category>>("/v1/categories", {
      body: { name },
      method: "POST",
    });
    return { id: made.data.id, name: made.data.attributes.name };
  }

  let filterInput = $state<HTMLInputElement>();
  let createInput = $state<HTMLInputElement>();
  let newName = $state("");
  let creating = $state(false);
  let createError = $state("");

  const showHref = (row: CategoryRow) =>
    periodPath(`/categories/show/${row.item.id}`, period.start, period.end);

  async function remove(row: CategoryRow) {
    await api(`/v1/categories/${row.item.id}`, { method: "DELETE" });
    await invalidate();
  }

  async function create(event: SubmitEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (creating) {
      return;
    }
    if (!name) {
      createError = "Type a name first";
      createInput?.focus();
      return;
    }
    creating = true;
    createError = "";
    try {
      await api("/v1/categories", { body: { name }, method: "POST" });
      newName = "";
      await invalidate();
    } catch (failure) {
      createError = failure instanceof Error ? failure.message : "Failed";
    } finally {
      creating = false;
    }
  }

  const nav: ListNav<CategoryRow> = new ListNav<CategoryRow>({
    edit: (row) => goto(`/categories/edit/${row.item.id}`),
    extra: (): Binding[] => [
      {
        group: "Categories",
        keys: "/",
        label: "Filter categories",
        run: () => filterInput?.focus(),
      },
      {
        group: "Categories",
        keys: "c",
        label: "New category",
        run: () => createInput?.focus(),
      },
      {
        group: "Categories",
        keys: "w",
        label: "Transactions without a category",
        run: () => goto(noCategoryHref),
      },
    ],
    id: "categories",
    items: () => rows,
    key: (row) => row.item.id,
    open: (row) => goto(showHref(row)),
  });

  useKeys(() => [
    ...(triaging ? [] : nav.bindings()),
    {
      group: "Categories",
      keys: "t",
      label: triaging ? "Stop sorting" : "Sort transactions without a category",
      run: () => (triaging = !triaging),
    },
  ]);
</script>

<PageHeader crumbs={[{ label: "Categories" }]} title="Categories">
  {#snippet actions()}
    <Button href="/categories/create" size="sm" variant="outline">
      <Plus />New category
    </Button>
  {/snippet}
</PageHeader>

{#if query.isError}
  <p class="text-expense">Could not load categories: {query.error.message}</p>
{/if}

<Box body="p-0" title="Categories">
  {#snippet tools()}
    <input
      aria-label="Filter categories"
      class="cladd-cut cladd-focusable-input h-7 w-48 rounded-cladd-sm px-2 text-[12px]"
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
  {/snippet}
  <div class="overflow-x-auto">
    <table class="w-full min-w-[40rem] text-[13px]">
      <thead>
        <tr
          class="h-8 border-cladd-outline border-b text-left text-[12px] text-cladd-fg-soft"
        >
          {#each SORTS as column (column.key)}
            <th
              aria-sort={sort === column.key ? "ascending" : undefined}
              class="px-3 font-medium {column.key === "name"
                ? ""
                : "text-right"} {column.key === "activity"
                ? "hidden md:table-cell"
                : ""}"
            >
              <button
                class="inline-flex items-center gap-1 hover:text-cladd-fg {sort ===
                column.key
                  ? "text-cladd-fg"
                  : ""}"
                onclick={() =>
                  setParam("sort", column.key === "name" ? "" : column.key)}
                type="button"
              >
                {column.label}
                {#if sort === column.key}
                  <ArrowDown class="size-3" />
                {/if}
              </button>
            </th>
            {#if column.key === "earned"}
              <th class="w-[22%] px-3 font-medium">
                Share of {display.active ? "≈" : ""}{main}
                spending
              </th>
            {/if}
          {/each}
        </tr>
      </thead>
      <ListMenu
        deleteLabel="Delete category"
        items={() => [
          {
            keys: "Enter",
            label: "Show",
            run: () => nav.current && goto(showHref(nav.current)),
          },
          {
            keys: "e",
            label: "Edit category",
            run: () =>
              nav.current && goto(`/categories/edit/${nav.current.item.id}`),
          },
          {
            label: "Open in old UI",
            run: () =>
              nav.current &&
              location.assign(
                oldUiUrl(
                  `${location.origin}/categories/show/${nav.current.item.id}`
                )
              ),
          },
        ]}
        ondelete={() => nav.current && remove(nav.current)}
      >
        {#snippet children(
          props
        )}
          <tbody {...props}>
            <tr class="h-7 border-cladd-outline border-b">
              <td class="px-3">
                <a
                  class="text-brand italic hover:underline"
                  href={noCategoryHref}
                  >Without a category</a
                >
              </td>
              <td class="px-3 text-right">
                <MoneyList sums={query.data?.spent ?? []} />
              </td>
              <td class="px-3 text-right">
                <MoneyList sums={query.data?.earned ?? []} />
              </td>
              <td class="px-3">
                {@render bar(measure(query.data?.spent ?? []))}
              </td>
              <td class="hidden md:table-cell"></td>
            </tr>
            {#each rows as row, i (row.item.id)}
              <tr
                class="h-7 border-cladd-outline border-b last:border-b-0 {nav.cursor ===
                  i && !triaging
                  ? "bg-row-cursor"
                  : "hover:bg-row-hover"}"
                id={nav.rowId(i)}
                onclick={(event) => {
                  triaging = false;
                  nav.click(i, event);
                }}
                oncontextmenu={() => (nav.cursor = i)}
              >
                <td class="px-3">
                  <a class="text-cladd-fg hover:underline" href={showHref(row)}
                    >{row.item.attributes.name}</a
                  >
                </td>
                <td class="px-3 text-right">
                  <MoneyList sums={row.spent} />
                </td>
                <td class="px-3 text-right">
                  <MoneyList sums={row.earned} />
                </td>
                <td class="px-3">{@render bar(measure(row.spent))}</td>
                <td
                  class="num hidden px-3 text-right text-[12px] text-cladd-fg-soft md:table-cell"
                >
                  {row.item.attributes.last_activity
                    ? formatDate(row.item.attributes.last_activity)
                    : "never"}
                </td>
              </tr>
            {:else}
              {#if !query.isPending}
                <tr>
                  <td class="px-3 py-3 text-cladd-fg-soft" colspan="5">
                    {filter ? "No category matches." : "No categories yet."}
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
    <form class="flex flex-1 items-center gap-2" onsubmit={create}>
      <input
        aria-label="New category name"
        class="cladd-cut cladd-focusable-input h-7 w-64 rounded-cladd-sm px-2 text-[13px]"
        oninput={() => (createError = "")}
        placeholder="New category name (c)"
        bind:this={createInput}
        bind:value={newName}
      >
      <Button disabled={creating} size="sm" type="submit">Create</Button>
      {#if createError}
        <span class="text-expense">{createError}</span>
      {/if}
    </form>
  {/snippet}
</Box>

<Triage
  active={triaging}
  assignPatch={(id) => ({ category_id: id })}
  clearPatch={{ category_name: null }}
  create={createCategory}
  empty={everything
    ? "Every transaction has a category."
    : `Every transaction in ${period.label} has a category.`}
  {everything}
  hint={(place) => learnedCategories.get(place.key)?.name ?? null}
  ignoreKey="ffui.category-ignored"
  loading={triage.isPending}
  noun="category"
  onactivate={() => (triaging = true)}
  onassign={(place, option) => learnedCategories.remember(place.key, option)}
  onchange={() => refreshExcept(triageKey)}
  onleave={() => (triaging = false)}
  onswitch={() => setParam("scope", everything ? "" : "all")}
  {options}
  periodLabel={period.label}
  pickKey="c"
  {places}
  problem={triage.isError ? `Could not load: ${triage.error.message}` : ""}
  title="Transactions without a category"
/>

{#snippet bar(
  spent: number
)}
  {@const value = share(spent)}
  {#if value > 0}
    <div class="flex items-center gap-2">
      <div
        class="h-2 flex-1 overflow-hidden rounded-full bg-cladd-surface-next"
      >
        <div
          class="h-full rounded-full bg-expense/70"
          style:width="{value * 100}%"
        ></div>
      </div>
      <span class="num w-10 text-right text-[12px] text-cladd-fg-soft"
        >{percent(value)}</span
      >
    </div>
  {/if}
{/snippet}
