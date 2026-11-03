<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import Pencil from "@lucide/svelte/icons/pencil";
  import X from "@lucide/svelte/icons/x";
  import { createQuery } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import { lists } from "#lib/api/lists.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Blockades from "#lib/v2/components/Blockades.svelte";
  import Chip from "#lib/v2/components/Chip.svelte";
  import Filter from "#lib/v2/components/Filter.svelte";
  import LookChip from "#lib/v2/components/LookChip.svelte";
  import Tag from "#lib/v2/components/Tag.svelte";
  import TxRow from "#lib/v2/components/TxRow.svelte";
  import NameForm from "#lib/v2/forms/NameForm.svelte";
  import { q } from "#lib/v2/data.js";
  import { look } from "#lib/v2/look.svelte.js";
  import { view } from "#lib/v2/money.svelte.js";
  import { rowValue, spendByCategory, totals } from "#lib/v2/stats.js";
  import { BLOCKADE_TAG, BLOCKED_TAG, byDay, currentBlockades, isBlockade, type Row, signed, toRow } from "#lib/v2/tx.js";
  import { today } from "#lib/dates.js";
  import { dayLabel, periodName } from "#lib/v2/when.js";

  const txs = createQuery(() => q.transactions(period.start, period.end));
  const blocked = createQuery(() => q.blocked());
  const accounts = createQuery(() => lists.accounts("all"));
  const categories = createQuery(() => lists.categories());
  const tags = createQuery(() => lists.tags());
  const budgets = createQuery(() => lists.budgets());
  const bills = createQuery(() => q.bills(period.start, period.end));

  const params = $derived(page.url.searchParams);
  const fAccount = $derived(params.get("account"));
  const fCategory = $derived(params.get("category"));
  const fTag = $derived(params.get("tag"));
  const fBudget = $derived(params.get("budget"));
  const fType = $derived(params.get("type"));
  const fBill = $derived(params.get("bill"));
  let search = $state(page.url.searchParams.get("q") ?? "");
  let searchBox = $state<HTMLInputElement>();
  let renaming = $state(false);

  $effect(() => {
    if (params.get("focus")) {
      searchBox?.focus();
      set({ focus: null });
    }
  });

  function set(changes: Record<string, string | null>) {
    const next = new URL(page.url.href);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") {
        next.searchParams.delete(key);
      } else {
        next.searchParams.set(key, value);
      }
    }
    goto(next, { replace: true });
  }

  const loaded = $derived((txs.data ?? []).map(toRow));
  const all = $derived(loaded.filter((row) => !isBlockade(row)));
  const narrowed = $derived(Boolean(fCategory || fTag || fBudget || fBill || search.trim() || (fType && fType !== "withdrawal")));
  const lump = $derived(narrowed ? [] : loaded.filter((row) => isBlockade(row) && (!fAccount || row.accountId === fAccount)));
  const held = $derived(narrowed ? [] : currentBlockades(loaded, (blocked.data ?? []).map(toRow), period.start, period.end, today()).filter((row) => !fAccount || row.accountId === fAccount));

  function matches(row: Row): boolean {
    if (fAccount && row.accountId !== fAccount && row.otherId !== fAccount) {
      return false;
    }
    if (fCategory && !row.splits.some((s) => (s.category_id ?? "none") === fCategory)) {
      return false;
    }
    if (fTag && !row.tags.includes(fTag)) {
      return false;
    }
    if (fBudget && !row.splits.some((s) => s.budget_id === fBudget)) {
      return false;
    }
    if (fBill && !row.splits.some((s) => (s.bill_id ?? s.subscription_id) === fBill)) {
      return false;
    }
    if (fType && row.type !== fType) {
      return false;
    }
    const text = search.trim().toLowerCase();
    if (text) {
      const hay = [row.title, row.raw, row.notes, row.category, row.account, row.other, ...row.tags, row.splits.map((s) => s.description).join(" "), String(Math.abs(row.amount))]
        .join(" ")
        .toLowerCase();
      return text.split(/\s+/).every((word) => hay.includes(word));
    }
    return true;
  }

  const rows = $derived(all.filter(matches));
  const FIRST_PAINT = 20;
  let limit = $state(FIRST_PAINT);
  const days = $derived(byDay(rows.slice(0, limit)));

  onMount(() => {
    const id = setTimeout(() => (limit = Number.POSITIVE_INFINITY), 120);
    return () => clearTimeout(id);
  });
  const flat = $derived(days.flatMap(([, list]) => list));
  const sum = $derived(view.ready ? totals([...rows, ...lump]) : { earned: 0, spent: 0 });
  const slices = $derived(view.ready ? spendByCategory(rows).slice(0, 6) : []);
  const tagCounts = $derived.by(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      for (const tag of row.tags) {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  });

  const nav = new ListNav<Row>({
    id: "tx",
    items: () => flat,
    key: (row) => row.id,
    open: (row) => goto(`/tx/${row.id}`),
    edit: (row) => goto(`/transactions/edit/${row.id}`),
  });
  nav.use();

  const accountOptions = $derived(
    (accounts.data ?? [])
      .filter((a) => ["asset", "liabilities", "liability"].includes(a.attributes.type) && a.attributes.active)
      .map((a) => ({ id: a.id, label: a.attributes.name, look: look.of("account", a.id, a.attributes.name, a.attributes.account_role ?? undefined) }))
  );
  const categoryOptions = $derived([
    ...(categories.data ?? []).map((c) => ({ id: c.id, label: c.attributes.name, look: look.of("category", c.id, c.attributes.name) })),
    { id: "none", label: "No category" },
  ]);
  const tagOptions = $derived((tags.data ?? []).filter((t) => t.attributes.tag !== BLOCKADE_TAG && t.attributes.tag !== BLOCKED_TAG).map((t) => ({ id: t.attributes.tag, label: t.attributes.tag, look: look.of("tag", t.attributes.tag, t.attributes.tag) })));
  const budgetOptions = $derived((budgets.data ?? []).map((b) => ({ id: b.id, label: b.attributes.name, look: look.of("budget", b.id, b.attributes.name) })));
  const typeOptions = [
    { id: "withdrawal", label: "Spending" },
    { id: "deposit", label: "Income" },
    { id: "transfer", label: "Transfers" },
  ];

  const focus = $derived.by(() => {
    if (fCategory && fCategory !== "none") {
      const c = categoryOptions.find((o) => o.id === fCategory);
      return c ? { id: c.id, kind: "category" as const, name: c.label, what: "Category" } : null;
    }
    if (fTag) {
      return { id: fTag, kind: "tag" as const, name: fTag, what: "Tag" };
    }
    if (fBudget) {
      const b = budgetOptions.find((o) => o.id === fBudget);
      return b ? { id: b.id, kind: "budget" as const, name: b.label, what: "Budget" } : null;
    }
    if (fBill) {
      const b = bills.data?.find((x) => x.id === fBill);
      return b ? { id: b.id, kind: "bill" as const, name: b.attributes.name ?? "", what: "Subscription" } : null;
    }
    return null;
  });

  const filtered = $derived(Boolean(fAccount || fCategory || fTag || fBudget || fBill || fType || search));
</script>

<svelte:head><title>Transactions · Dragonfly</title></svelte:head>

<div class="layout">
  <section class="panel list">
    <div class="filters">
      <label class="find">
        <Search size={16} />
        <input
          bind:this={searchBox}
          bind:value={search}
          onkeydown={(e) => e.key === "Escape" && (e.currentTarget.blur(), (search = ""))}
          oninput={() => set({ q: search })}
          placeholder="Search names, notes, tags, amounts"
        />
        {#if search}
          <button aria-label="Clear search" class="x" onclick={() => ((search = ""), set({ q: null }))}><X size={14} /></button>
        {:else}
          <kbd>/</kbd>
        {/if}
      </label>
      <div class="pick">
      <Filter label="Account" onchange={(id) => set({ account: id })} options={accountOptions} value={fAccount} />
      <Filter label="Category" onchange={(id) => set({ category: id })} options={categoryOptions} value={fCategory} />
      <Filter label="Tag" onchange={(id) => set({ tag: id })} options={tagOptions} value={fTag} />
      {#if budgetOptions.length}
        <Filter label="Budget" onchange={(id) => set({ budget: id })} options={budgetOptions} value={fBudget} />
      {/if}
      <Filter label="Type" onchange={(id) => set({ type: id })} options={typeOptions} value={fType} />
      </div>
    </div>

    {#if txs.isPending}
      {#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
        <div class="skeleton" style="height: 38px; margin: 10px 16px"></div>
      {/each}
    {:else if rows.length === 0}
      <div class="empty">
        <p>{filtered ? "No transactions match these filters." : `Nothing happened in ${periodName(period.start, period.end)}.`}</p>
        {#if filtered}
          <a class="btn" href="/tx">Clear filters</a>
        {/if}
      </div>
    {:else}
      {#each days as [day, list] (day)}
        {@const net = list.reduce((s, r) => s + signed(r, rowValue(r)), 0)}
        <div class="day">
          <span>{dayLabel(day)}</span>
          <span class:pos={net > 0} class:muted={net <= 0}>{net === 0 ? "" : view.show(net, { signed: true })}</span>
        </div>
        {#each list as row (row.id)}
          {@const index = flat.indexOf(row)}
          <TxRow cursor={nav.cursor === index} id={nav.rowId(index)} {row} showAccount={!fAccount} />
        {/each}
      {/each}
    {/if}
  </section>

  <aside>
    {#if focus}
      <section class="panel focus">
        <LookChip id={focus.id} kind={focus.kind} name={focus.name} size={48} />
        <div class="focus-text">
          <div class="small">{focus.what}</div>
          <div class="focus-name">{focus.name}</div>
        </div>
        {#if focus.kind === "category" || focus.kind === "tag"}
          <button aria-label="Rename" class="ib rename" onclick={() => (renaming = true)} title="Rename" type="button"><Pencil size={15} /></button>
        {/if}
      </section>
    {/if}
    <section class="panel">
      <div class="small">{periodName(period.start, period.end)} · {rows.length} transactions</div>
      <div class="sums">
        <button class="sum" onclick={() => set({ type: "withdrawal" })}>
          <span class="small">Spent</span>
          <span class="big-sum" data-copy>{view.show(sum.spent, { decimals: 0 })}</span>
        </button>
        <button class="sum" onclick={() => set({ type: "deposit" })}>
          <span class="small">Earned</span>
          <span class="big-sum pos" data-copy>{view.show(sum.earned, { decimals: 0 })}</span>
        </button>
      </div>
      {#if slices.length}
        <hr class="rule" />
        <div class="cats">
          {#each slices as slice (slice.id ?? "none")}
            {@const l = look.of("category", slice.id, slice.name)}
            <button class="cat" onclick={() => set({ category: slice.id ?? "none" })}>
              <Chip color={l.color} icon={l.icon} size={24} radius={7} />
              <span class="name">{slice.name}</span>
              <span class="muted">{view.show(slice.value, { decimals: 0 })}</span>
            </button>
          {/each}
        </div>
      {/if}
    </section>
    {#if view.ready}
      <Blockades rows={held} />
    {/if}
    {#if tagCounts.length}
      <section class="panel tag-list">
        <h1>Tags</h1>
        <div class="tags">
          {#each tagCounts as [tag] (tag)}
            <Tag href="/tx?tag={encodeURIComponent(tag)}" {tag} />
          {/each}
        </div>
      </section>
    {/if}
  </aside>
</div>

{#if focus && (focus.kind === "category" || focus.kind === "tag")}
  <NameForm bind:open={renaming} id={focus.id} kind={focus.kind} name={focus.name} />
{/if}

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 20px;
    align-items: start;
  }
  .list {
    padding: 16px 12px 12px;
  }
  .filters {
    display: flex;
    gap: 8px;
    padding: 0 4px 8px;
    flex-wrap: wrap;
  }
  .pick {
    display: contents;
  }
  .find {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 38px;
    padding: 0 8px 0 12px;
    border-radius: 11px;
    background: var(--sunk);
    color: var(--faint);
  }
  .find input {
    flex: 1;
    border: 0;
    outline: 0;
    background: none;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    min-width: 0;
  }
  .find input::placeholder {
    color: var(--faint);
  }
  .x {
    border: 0;
    background: none;
    color: var(--mute);
    cursor: pointer;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
  }
  .day {
    display: flex;
    gap: 10px;
    padding: 16px 16px 6px;
    font-size: 12.5px;
    font-weight: 700;
  }
  .empty {
    padding: 60px 20px;
    text-align: center;
    color: var(--mute);
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  aside {
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 92px;
  }
  .focus {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .focus-text {
    flex: 1;
    min-width: 0;
  }
  .rename {
    width: 32px;
    height: 32px;
    border: 0;
  }
  .focus-name {
    font-size: 19px;
    font-weight: 800;
  }
  .sums {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 16px;
  }
  .sum {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    border: 0;
    background: none;
    padding: 6px 8px;
    margin: -6px -8px;
    border-radius: 10px;
    cursor: pointer;
    color: var(--ink);
  }
  .sum:hover {
    background: var(--hover);
  }
  .big-sum {
    font-size: 22px;
    font-weight: 800;
    margin-top: 2px;
  }
  .rule {
    margin: 18px 0;
  }
  .cats {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 -8px;
  }
  .cat {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 8px;
    border-radius: 10px;
    border: 0;
    background: none;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--ink);
    text-align: left;
  }
  .cat:hover {
    background: var(--hover);
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
    aside {
      position: static;
      order: -1;
      gap: 14px;
    }
    .tag-list,
    .rule,
    .cats {
      display: none;
    }
    .sums {
      margin-top: 10px;
    }
    .list {
      padding: 12px 8px 8px;
      min-width: 0;
      overflow: hidden;
    }
    .filters {
      flex-direction: column;
      padding: 0 2px 8px;
    }
    .find {
      flex: none;
      width: 100%;
      min-width: 0;
    }
    .pick {
      display: flex;
      width: calc(100% + 20px);
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
      margin: 0 -10px;
      padding: 0 10px;
    }
    .find kbd {
      display: none;
    }
    .day {
      padding: 14px 6px 2px;
    }
  }
</style>
