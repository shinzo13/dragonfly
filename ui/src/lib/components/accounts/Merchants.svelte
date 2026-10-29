<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import {
    byCategory,
    type Kind,
    type Merchant,
    SORT_KEYS,
    type SortKey,
    sortBy,
    type Total,
  } from "#lib/accounts/merchants.js";
  import { useMerchants } from "#lib/accounts/merchants.svelte.js";
  import { api } from "#lib/api/client.js";
  import { invalidate, lists } from "#lib/api/lists.js";
  import Box from "#lib/components/Box.svelte";
  import { currency } from "#lib/components/dashboard/data.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import SuggestInput from "#lib/components/transactions/SuggestInput.svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { today } from "#lib/dates.js";
  import { formatDate, formatMoney, percent } from "#lib/format.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { versusText } from "#lib/reports/typical.js";
  import {
    type Outcome,
    patchFor,
    type Targets,
    updateGroups,
  } from "#lib/transactions/mass.js";
  import type { Suggestion } from "#lib/transactions/query.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { editUrl, openOld, showUrl, TYPE_ONE, TYPE_TITLE } from "./links.js";
  import MerchantCell, { type Column } from "./MerchantCell.svelte";

  const NONE = "\u0000";
  const SAME = 0.03;
  const WIDE: Column[] = [
    "share",
    "visits",
    "avg",
    "spark",
    "typical",
    "last",
    "category",
  ];

  let { kind }: { kind: Kind } = $props();

  const data = useMerchants(() => kind);
  const noun = $derived(kind === "expense" ? "Merchants" : "Payers");
  const createHref = $derived(`/accounts/create/${kind}`);

  const params = $derived(page.url.searchParams);
  const sort = $derived<SortKey>(
    SORT_KEYS.find((key) => key === params.get("sort")) ?? "month"
  );
  const grouped = $derived(params.get("group") === "category");
  const quietParam = $derived(params.has("quiet"));

  let filter = $state(page.url.searchParams.get("filter") ?? "");
  let filterInput = $state<HTMLInputElement>();
  let menu = $state<Merchant | null>(null);
  let armed = $state(false);
  let failure = $state("");

  let picking = $state<Merchant[] | null>(null);
  let text = $state("");
  let input = $state<HTMLInputElement>();
  let progress = $state("");
  let notes = $state<Record<string, string>>({});

  const day = $derived(data.day);
  const compare = $derived(day !== null);
  const current = $derived(day !== null && day < 31);
  const asOf = $derived(formatDate(today(), "short"));
  const needle = $derived(filter.trim().toLowerCase());
  const all = $derived(data.board?.merchants ?? []);
  const matching = $derived(
    needle
      ? all.filter((m) =>
          `${m.name} ${m.category ?? ""}`.toLowerCase().includes(needle)
        )
      : all
  );
  const order = $derived(sortBy(sort));
  const active = $derived(matching.filter((m) => !m.quiet).sort(order));
  const quiet = $derived(matching.filter((m) => m.quiet).sort(order));
  const quietOpen = $derived(quietParam || needle !== "");
  const sections = $derived(grouped ? byCategory(active, "No category") : null);
  const rows = $derived([
    ...(sections ? sections.flatMap((s) => s.merchants) : active),
    ...(quietOpen ? quiet : []),
  ]);
  const index = $derived(new Map(rows.map((m, i) => [m.id, i])));
  const max = $derived(Math.max(0, ...all.map((m) => m.share)));
  const activeCount = $derived(all.filter((m) => !m.quiet).length);
  const categorised = $derived(all.some((m) => m.category));
  const columns = $derived<{ key: Column; label: string; sort?: SortKey }[]>([
    {
      key: "name",
      label: kind === "expense" ? "Merchant" : "Payer",
      sort: "name",
    },
    {
      key: "month",
      label: current ? "This month" : "In period",
      sort: "month",
    },
    { key: "share", label: "Share" },
    {
      key: "visits",
      label: kind === "expense" ? "Visits" : "Payments",
      sort: "visits",
    },
    { key: "avg", label: "Average" },
    { key: "spark", label: "12 months", sort: "year" },
    { key: "typical", label: current ? `Typical by ${asOf}` : "Typical month" },
    { key: "change", label: "vs typical" },
    { key: "last", label: "Last", sort: "last" },
    ...(categorised ? [{ key: "category" as const, label: "Category" }] : []),
  ]);
  const NUMERIC = new Set<Column>([
    "month",
    "visits",
    "avg",
    "spark",
    "typical",
    "change",
    "last",
  ]);

  const categories = createQuery(() => ({
    ...lists.categories(),
    enabled: picking !== null,
  }));
  const suggestions = $derived.by<Suggestion[]>(() => {
    const names = (categories.data ?? []).map((c) => c.attributes.name);
    const query = text.trim();
    const found: Suggestion[] = fuzzyFilter(names, query, (n) => n, 8).map(
      (name) => ({ id: name, insert: name, label: name })
    );
    if (query && !names.some((n) => n.toLowerCase() === query.toLowerCase())) {
      found.push({
        hint: "new",
        id: `new:${query}`,
        insert: query,
        label: query,
      });
    }
    if (!query) {
      found.unshift({ id: NONE, insert: NONE, label: "(no category)" });
    }
    return found;
  });

  const journals = (targets: Targets) =>
    [...targets.values()].reduce((n, set) => n + (set?.size ?? 0), 0);

  function merge(list: Merchant[]): Targets {
    const targets: Targets = new Map();
    for (const m of list) {
      for (const [group, set] of m.targets) {
        targets.set(
          group,
          new Set([...(targets.get(group) ?? []), ...(set ?? [])])
        );
      }
    }
    return targets;
  }

  const pickCount = $derived(picking ? journals(merge(picking)) : 0);

  async function pick() {
    const list = chosen.filter((m) => m.targets.size > 0);
    if (list.length === 0) {
      notes = Object.fromEntries(
        chosen.map((m) => [m.id, `nothing in ${period.label}`])
      );
      return;
    }
    picking = list;
    text = "";
    progress = "";
    await tick();
    input?.focus();
  }

  function cancel() {
    if (!progress) {
      picking = null;
    }
  }

  async function apply(raw: string) {
    const list = picking;
    if (!list || progress) {
      return;
    }
    const value = raw === NONE ? null : raw.trim() || null;
    const say = (o: Outcome) => {
      progress = `Setting “${value ?? "no category"}”: ${o.done} of ${o.total}`;
    };
    const outcome = await updateGroups(
      merge(list),
      patchFor({ id: null, mode: "category", value }),
      say
    );
    await invalidate();
    const failed = outcome.errors.join("; ");
    const next = { ...notes };
    for (const m of list) {
      next[m.id] = failed
        ? `failed: ${failed}`
        : `${value ? "set" : "cleared"} on ${journals(m.targets)}`;
    }
    notes = next;
    progress = "";
    picking = null;
    nav.clear();
  }

  let pending = "";

  function setParam(name: string, value: string | null) {
    const url = new URL(pending || page.url.href);
    if (value === null) {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, value);
    }
    url.searchParams.set("start", period.start);
    url.searchParams.set("end", period.end);
    pending = url.href;
    goto(url, { replace: true, reset: false }).finally(() => {
      if (pending === url.href) {
        pending = "";
      }
    });
  }

  const setSort = (key: SortKey) =>
    setParam("sort", key === "month" ? null : key);
  const toggleGroup = () => setParam("group", grouped ? null : "category");
  const toggleQuiet = () => setParam("quiet", quietParam ? null : "1");

  const nav = new ListNav<Merchant>({
    edit: (m) => goto(editUrl(m.id)),
    extra: () => [
      {
        group: noun,
        keys: "/",
        label: `Filter ${noun.toLowerCase()}`,
        run: () => {
          filterInput?.focus();
          filterInput?.select();
        },
      },
      {
        group: noun,
        keys: "c",
        label: `Create a new ${TYPE_ONE[kind]}`,
        run: () => goto(createHref),
      },
      ...SORT_KEYS.map((key, i) => ({
        group: noun,
        keys: String(i + 1),
        label: `Sort by ${columns.find((c) => c.sort === key)?.label.toLowerCase()}`,
        run: () => setSort(key),
      })),
      {
        group: noun,
        keys: ";",
        label: grouped ? "Ungroup" : "Group by category",
        run: toggleGroup,
      },
      {
        group: noun,
        keys: "i",
        label: quietParam
          ? `Hide quiet ${noun.toLowerCase()}`
          : `Show quiet ${noun.toLowerCase()}`,
        run: toggleQuiet,
      },
      {
        group: noun,
        keys: "s c",
        label: "Set category on their transactions",
        run: pick,
      },
    ],
    id: "merchants",
    items: () => rows,
    key: (m) => m.id,
    open: (m) => goto(showUrl(m.id)),
    selectable: true,
  });
  nav.use();

  const chosen = $derived.by(() => {
    if (nav.selected.size > 0) {
      return all.filter((m) => nav.selected.has(m.id));
    }
    return nav.current ? [nav.current] : [];
  });
  const anchorId = $derived(
    picking
      ? (rows.find((m) => picking?.some((p) => p.id === m.id)) ?? nav.current)
          ?.id
      : null
  );

  function onfilter() {
    nav.cursor = -1;
    setParam("filter", filter || null);
  }

  function onfilterkey(event: KeyboardEvent) {
    if (event.key === "Escape" && filter) {
      filter = "";
      onfilter();
    } else if (event.key === "Enter" && rows[0]) {
      event.preventDefault();
      filterInput?.blur();
      nav.move(0);
    }
  }

  function oncontextmenu(event: MouseEvent) {
    const tr = (event.target as Element).closest("tr[data-id]");
    armed = false;
    menu = rows.find((m) => m.id === tr?.getAttribute("data-id")) ?? null;
    if (menu) {
      nav.cursor = index.get(menu.id) ?? -1;
    }
  }

  async function remove(m: Merchant) {
    failure = "";
    try {
      await api(`/v1/accounts/${m.id}`, { method: "DELETE" });
      await invalidate();
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
  }

  function rowClass(m: Merchant, i: number) {
    if (nav.cursor === i) {
      return "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]";
    }
    return nav.isSelected(m) ? "bg-row-selected" : "hover:bg-row-hover";
  }

  function cellClass(key: Column) {
    const align = NUMERIC.has(key) ? "text-right" : "";
    const wide = WIDE.includes(key) ? "hidden md:table-cell" : "";
    return `${align} ${wide}`;
  }

  function money(t: Total) {
    const shown = formatMoney({ ...currency(t.code), amount: t.amount });
    return t.approx ? `≈${shown}` : shown;
  }

  function tone(ratio: number | null) {
    if (ratio === null || Math.abs(ratio) < SAME) {
      return "text-cladd-fg-soft";
    }
    const bad = kind === "expense" ? ratio > 0 : ratio < 0;
    return bad ? "text-expense" : "text-cladd-fg-soft";
  }
</script>

{#snippet sums(
  list: Total[]
)}
  {#each list as t (t.code)}
    <div class="num">{money(t)}</div>
  {/each}
{/snippet}

{#snippet row(
  m: Merchant
)}
  {@const i = index.get(m.id) ?? -1}
  <tr
    class="border-cladd-outline/60 border-t align-top {rowClass(m, i)}"
    data-id={m.id}
    id={nav.rowId(i)}
    onclick={(event) => nav.click(i, event)}
  >
    {#each columns as col (col.key)}
      <td class="h-7 whitespace-nowrap px-2 py-1 sm:px-3 {cellClass(col.key)}">
        <MerchantCell
          col={col.key}
          {compare}
          {kind}
          {max}
          merchant={m}
          note={notes[m.id]}
          past={data.board?.past ?? 0}
        />
      </td>
    {/each}
  </tr>
  {#if anchorId === m.id && picking}
    <tr class="bg-row-selected/50">
      <td class="px-3 py-1.5" colspan={columns.length}>
        <div class="flex flex-wrap items-center gap-2 text-[12px]">
          {#if progress}
            <span aria-live="polite">{progress}</span>
          {:else}
            <label class="text-cladd-fg-soft" for="merchant-category"
              >Category for {pickCount}
              {pickCount === 1 ? "transaction" : "transactions"}
              at
              {picking.length === 1
                ? picking[0].name
                : `${picking.length} ${noun.toLowerCase()}`}:</label
            >
            <SuggestInput
              class="w-72"
              id="merchant-category"
              onaccept={(item) => {
                apply(item.insert);
                return true;
              }}
              onblur={cancel}
              oncancel={cancel}
              onsubmit={() => apply(text)}
              placeholder="Type to filter"
              {suggestions}
              bind:input
              bind:value={text}
            />
            <span class="text-cladd-fg-softer"
              ><span class="kbd">↵</span>
              apply <span class="kbd">Esc</span>
              cancel</span
            >
          {/if}
        </div>
      </td>
    </tr>
  {/if}
{/snippet}

<PageHeader crumbs={[{ label: TYPE_TITLE[kind] }]} title="Accounts">
  {#snippet actions()}
    <a
      class="cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-color-green inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-[12px] text-cladd-primary"
      href={createHref}
      title="Create a new {TYPE_ONE[kind]}  c"
    >
      <Plus class="size-3.5" />
      Create a new {TYPE_ONE[kind]}
    </a>
  {/snippet}
</PageHeader>

<Box body="p-0" title="{noun} in {period.label}">
  {#snippet tools()}
    <button
      aria-pressed={grouped}
      class="hidden h-7 sm:inline-flex items-center gap-1.5 rounded-cladd-sm px-2 text-[12px] {grouped
        ? "bg-row-selected text-cladd-fg"
        : "text-cladd-fg-soft hover:text-cladd-fg"}"
      onclick={toggleGroup}
      type="button"
    >
      By category <span class="kbd">;</span>
    </button>
    <input
      aria-label="Filter {noun.toLowerCase()}"
      class="cladd-cut h-7 w-36 rounded-cladd-sm px-2 text-[12px] outline-none placeholder:text-cladd-fg-softer sm:w-56"
      oninput={onfilter}
      onkeydown={onfilterkey}
      placeholder="Filter  /"
      type="search"
      bind:this={filterInput}
      bind:value={filter}
    >
  {/snippet}
  {#if data.error}
    <p class="p-3 text-expense">{data.error.message}</p>
  {:else if data.loading || !data.board}
    <div class="h-40"></div>
  {:else}
    {@const b = data.board}
    <div
      class="flex flex-col gap-0.5 border-cladd-outline border-b px-3 py-2 text-[13px]"
    >
      <p class="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
        <span class="text-cladd-fg-soft"
          >{kind === "expense" ? "Spent" : "Earned"}</span
        >
        {#each b.totals as t (t.code)}
          <span class="whitespace-nowrap">
            <span class="num font-semibold text-[15px]">{money(t)}</span>
            {#if t.ratio !== null}
              <span class={tone(t.ratio)}
                >{versusText(t.ratio)}{current ? ` by ${asOf}` : ""}</span
              >
            {/if}
          </span>
        {:else}
          <span class="text-cladd-fg-soft">nothing yet</span>
        {/each}
      </p>
      <p class="text-[12px] text-cladd-fg-soft">
        {activeCount}
        of {all.length}
        {noun.toLowerCase()}
        {#if activeCount > 5}
          · top 5 take {percent(b.top)}
        {/if}
        {#if b.fresh > 0}
          · {b.fresh} new
        {/if}
      </p>
    </div>
    <ContextMenu>
      <ContextMenuTrigger
        class="block {picking ? "overflow-visible" : "overflow-x-auto"}"
        {oncontextmenu}
      >
        <table
          class="w-full border-collapse text-[13px] transition-opacity {data.stale
            ? "opacity-60"
            : ""}"
        >
          <thead class="border-cladd-outline border-b text-left">
            <tr class="h-8">
              {#each columns as col (col.key)}
                <th
                  aria-sort={col.sort && sort === col.sort
                    ? "descending"
                    : undefined}
                  class="whitespace-nowrap px-2 font-semibold text-[12px] text-cladd-fg-soft sm:px-3 {cellClass(
                    col.key
                  )}"
                  scope="col"
                >
                  {#if col.sort}
                    {@const n = SORT_KEYS.indexOf(col.sort) + 1}
                    <button
                      class="inline-flex items-center gap-1 hover:text-cladd-fg {sort ===
                      col.sort
                        ? "text-cladd-fg"
                        : ""}"
                      onclick={() => col.sort && setSort(col.sort)}
                      title="Sort  {n}"
                      type="button"
                    >
                      {col.label}
                      {#if sort === col.sort}
                        <ArrowDown class="size-3" />
                      {:else}
                        <span
                          class="font-normal text-[11px] text-cladd-fg-softer"
                          >{n}</span
                        >
                      {/if}
                    </button>
                  {:else}
                    {col.label}
                  {/if}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#if sections}
              {#each sections as s (s.key)}
                <tr class="border-cladd-outline border-t-2 align-top">
                  <th
                    class="px-3 py-1 text-left font-semibold"
                    scope="rowgroup"
                  >
                    {s.label}
                    <span class="font-normal text-cladd-fg-soft"
                      >{s.merchants.length}</span
                    >
                  </th>
                  <td class="px-3 py-1 text-right font-semibold">
                    {@render sums(s.sums)}
                  </td>
                  <td class="hidden px-3 py-1 md:table-cell">
                    <span class="num text-cladd-fg-soft"
                      >{percent(s.share)}</span
                    >
                  </td>
                  <td class="hidden px-3 py-1 text-right md:table-cell">
                    <span class="num">{s.visits}</span>
                  </td>
                  <td class="px-3 py-1" colspan={columns.length - 4}></td>
                </tr>
                {#each s.merchants as m (m.id)}
                  {@render row(m)}
                {/each}
              {/each}
            {:else}
              {#each active as m (m.id)}
                {@render row(m)}
              {/each}
            {/if}
            {#if quiet.length > 0}
              <tr class="border-cladd-outline border-t-2">
                <td class="px-3 py-1" colspan={columns.length}>
                  <button
                    class="inline-flex items-center gap-1.5 text-[12px] text-cladd-fg-soft hover:text-cladd-fg"
                    onclick={toggleQuiet}
                    type="button"
                  >
                    {quietOpen ? "Quiet" : `${quiet.length} quiet`}
                    {current ? "this month" : `in ${period.label}`}
                    {#if !needle}
                      <span class="kbd">i</span>
                    {/if}
                  </button>
                </td>
              </tr>
              {#if quietOpen}
                {#each quiet as m (m.id)}
                  {@render row(m)}
                {/each}
              {/if}
            {/if}
            {#if rows.length === 0 && needle}
              <tr>
                <td
                  class="px-3 py-6 text-center text-cladd-fg-soft"
                  colspan={columns.length}
                >
                  Nothing matches “{filter}”. Press Escape to clear.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-56">
        {#if menu}
          {@const target = menu}
          <ContextMenuItem onSelect={() => goto(showUrl(target.id))}>
            Show <ContextMenuShortcut>↵</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => goto(editUrl(target.id))}>
            Edit <ContextMenuShortcut>e</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={pick}>
            Set category <ContextMenuShortcut>s c</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={(event) => {
              if (armed) {
                remove(target);
                return;
              }
              event.preventDefault();
              armed = true;
            }}
            variant="destructive"
          >
            {armed ? `Press again to delete ${target.name}` : "Delete"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => openOld(showUrl(target.id))}>
            Open in old UI
          </ContextMenuItem>
        {:else}
          <ContextMenuItem disabled>Right-click a row</ContextMenuItem>
        {/if}
      </ContextMenuContent>
    </ContextMenu>
  {/if}
  {#snippet footer()}
    <a
      class="text-brand dark:text-(--ff-series-1) hover:underline"
      href={createHref}
      >Create a new {TYPE_ONE[kind]}</a
    >
    {#if failure}
      <span class="text-expense">{failure}</span>
    {/if}
    <a
      class="ml-auto text-cladd-fg-soft hover:underline"
      href="/inactive-accounts/{kind}"
      >Inactive {TYPE_TITLE[kind].toLowerCase()}</a
    >
  {/snippet}
</Box>
