<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import NotebookText from "@lucide/svelte/icons/notebook-text";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import { untrack } from "svelte";
  import type { Split } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import Money from "#lib/components/Money.svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import {
    formatDate,
    formatMoney,
    type Money as MoneyValue,
  } from "#lib/format.js";
  import type { Binding } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { type Section, subtotals } from "#lib/transactions/ledger.js";
  import {
    actionLabel,
    buildRows,
    type Mode,
    type Row,
  } from "#lib/transactions/mass.js";
  import { lastAction } from "#lib/transactions/repeat.svelte.js";
  import {
    accountUrl,
    balanceAfter,
    cloneUrl,
    editUrl,
    type Group,
    groupType,
    isCash,
    type Signed,
    showUrl,
    signedAmount,
    signedForeign,
    sumByCurrency,
  } from "#lib/transactions/split.js";
  import { ui } from "#lib/ui.svelte.js";
  import { goto } from "$app/navigation";
  import ActionBar from "./ActionBar.svelte";
  import TypeIcon from "./TypeIcon.svelte";

  let {
    groups,
    context = {},
    selectable = true,
    loading = false,
    id = "transactions",
    empty = "No transactions.",
    section,
  }: {
    groups: Group[];
    context?: { accountId?: string };
    selectable?: boolean;
    loading?: boolean;
    id?: string;
    empty?: string;
    section?: (group: Group) => Section;
  } = $props();

  interface Block extends Section {
    groups: Group[];
    keys: string[];
    sums: Signed[][];
  }

  let collapsed = $state(new Set<string>());
  let opened = $state(new Set<string>());
  let bar = $state<ActionBar>();
  let menuRows = $state<Row[]>([]);
  let menuArmed = $state(false);
  let barHeight = $state(0);

  const HEAD_HEIGHT = 32;
  const CHECKBOX = "size-3.5 cursor-pointer align-middle accent-(--ff-brand)";

  const accountId = $derived(context.accountId);
  const rows = $derived(buildRows(groups, collapsed));
  const blocks = $derived.by(() => {
    const starts = new Map<number, Block>();
    if (!section) {
      return starts;
    }
    const byKey = new Map<string, Block>();
    let previous: string | null = null;
    rows.forEach((row, index) => {
      const value = section(row.group);
      let block = byKey.get(value.key);
      if (!block) {
        block = { ...value, groups: [], keys: [], sums: [] };
        byKey.set(value.key, block);
      }
      if (row.kind !== "split") {
        block.groups.push(row.group);
      }
      block.keys.push(row.key);
      if (value.key !== previous) {
        starts.set(index, block);
        previous = value.key;
      }
    });
    for (const block of byKey.values()) {
      block.sums = byTone(subtotals(block.groups, context.accountId));
    }
    return starts;
  });

  $effect(() => {
    const present = new Set(rows.map((row) => row.key));
    untrack(() => {
      const kept = [...nav.selected].filter((key) => present.has(key));
      if (kept.length !== nav.selected.size) {
        nav.selected = new Set(kept);
      }
    });
  });

  function byTone(sums: Signed[]): Signed[][] {
    const tones = new Map<string, Signed[]>();
    for (const sum of sums) {
      tones.set(sum.tone, [...(tones.get(sum.tone) ?? []), sum]);
    }
    return [...tones.values()];
  }

  function selectKeys(keys: string[], on: boolean) {
    const next = new Set(nav.selected);
    for (const key of keys) {
      if (on) {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
    nav.selected = next;
  }

  function toggled(set: Set<string>, key: string, on: boolean) {
    const next = new Set(set);
    if (on) {
      next.add(key);
    } else {
      next.delete(key);
    }
    return next;
  }

  function open(row: Row | undefined) {
    if (row) {
      goto(showUrl(row.group.id));
    }
  }

  function expand(row: Row | undefined) {
    if (!row) {
      return;
    }
    if (row.kind === "head" && collapsed.has(row.group.id)) {
      collapsed = toggled(collapsed, row.group.id, false);
      return;
    }
    opened = toggled(opened, row.key, true);
  }

  function collapse(row: Row | undefined) {
    if (!row) {
      return;
    }
    if (opened.has(row.key)) {
      opened = toggled(opened, row.key, false);
      return;
    }
    if (row.kind === "single") {
      return;
    }
    collapsed = toggled(collapsed, row.group.id, true);
    nav.move(rows.findIndex((r) => r.key === row.group.id));
  }

  function action(mode: Mode, label: string, keys: string): Binding {
    return { group: "Selection", keys, label, run: () => bar?.start(mode) };
  }

  function bindings(): Binding[] {
    const list: Binding[] = [
      {
        group: "List",
        keys: "l",
        label: "Expand row: splits, notes",
        run: () => expand(nav.current),
      },
      {
        group: "List",
        keys: "h",
        label: "Collapse row",
        run: () => collapse(nav.current),
      },
      {
        group: "List",
        hidden: true,
        keys: "ArrowRight",
        label: "Expand row",
        run: () => expand(nav.current),
      },
      {
        group: "List",
        hidden: true,
        keys: "ArrowLeft",
        label: "Collapse row",
        run: () => collapse(nav.current),
      },
      {
        group: "List",
        keys: "i",
        label: ui.notes ? "Hide notes under rows" : "Show notes under rows",
        run: () => ui.toggleNotes(),
      },
      {
        group: "List",
        keys: "c",
        label: "Clone transaction",
        run: () => nav.current && goto(cloneUrl(nav.current.group)),
      },
    ];
    if (selectable) {
      list.push(
        action("category", "Set category", "s c"),
        action("budget", "Set budget", "s b"),
        action("bill", "Set subscription", "s s"),
        action("tag", "Add tag", "s t"),
        action("untag", "Remove tag", "s T"),
        {
          group: "Selection",
          keys: "d",
          label: "Delete (press twice)",
          run: () => bar?.remove(),
        }
      );
    }
    if (selectable && lastAction.current) {
      list.push({
        group: "Selection",
        keys: "s .",
        label: `Repeat: ${actionLabel(lastAction.current)}`,
        run: () => bar?.repeat(),
      });
    }
    return list;
  }

  function createNav() {
    return new ListNav<Row>({
      edit: (row) => goto(editUrl(row.group.id)),
      extra: bindings,
      id,
      items: () => rows,
      key: (row) => row.key,
      open,
      selectable,
    });
  }

  const nav = createNav();
  nav.use();

  function oncontextmenu(event: MouseEvent) {
    const tr = (event.target as Element).closest("tr[data-index]");
    menuArmed = false;
    if (!tr) {
      menuRows = [];
      return;
    }
    const index = Number(tr.getAttribute("data-index"));
    const row = rows[index];
    nav.cursor = index;
    menuRows = nav.isSelected(row) ? nav.selection : [row];
  }

  function oldUi(row: Row) {
    location.assign(
      oldUiUrl(new URL(showUrl(row.group.id), location.origin).href)
    );
  }

  function common(splits: Split[], pick: (split: Split) => string | null) {
    const values = new Set(splits.map(pick));
    return values.size === 1 ? [...values][0] : null;
  }

  function rowClass(row: Row, index: number) {
    const selected = nav.isSelected(row);
    const cursor = nav.cursor === index;
    let background = "hover:bg-row-hover";
    if (selected) {
      background = "bg-row-selected";
    } else if (cursor) {
      background = "bg-row-cursor";
    }
    const border = row.kind === "head" ? "border-cladd-outline border-t" : "";
    const mark = cursor ? "shadow-[inset_2px_0_0_var(--ff-brand)]" : "";
    return `${background} ${border} ${mark}`;
  }
</script>

{#snippet day(
  value: string | undefined
)}
  <span class="md:hidden">{formatDate(value?.slice(0, 10), "short")}</span>
  <span class="max-md:hidden">{formatDate(value?.slice(0, 10))}</span>
{/snippet}

{#snippet tagLinks(
  tags: string[] | null | undefined
)}
  {#each tags ?? [] as tag (tag)}
    <a
      class="text-cladd-fg-soft after:text-cladd-fg-softer hover:text-cladd-fg hover:underline [&:not(:last-child)]:after:content-[',_']"
      href={`/tags/show/${encodeURIComponent(tag)}`}
      >{tag}</a
    >
  {/each}
{/snippet}

{#snippet money(
  value: Signed
)}
  <Amount
    amount={value.amount}
    code={value.code}
    decimals={value.decimals}
    symbol={value.symbol}
    tone={value.tone}
  />
{/snippet}

{#snippet plain(
  value: MoneyValue | null
)}
  {#if value}
    {@const original = formatMoney(value)}
    {@const shown = display.text([value])}
    <span
      class="num text-cladd-fg-soft"
      title={shown === original ? undefined : original}
      >{shown}</span
    >
  {/if}
{/snippet}

{#snippet sum(
  parts: Signed[]
)}
  <Money {parts} tone={parts[0]?.tone === "transfer" ? "transfer" : "auto"} />
{/snippet}

{#snippet account(
  accountIdValue: string | null | undefined,
  name: string | null | undefined,
  type: string | null | undefined
)}
  {#if isCash(type)}
    <span class="text-income">(cash)</span>
  {:else if accountIdValue}
    <a
      class="block truncate hover:underline"
      href={accountUrl(accountIdValue)}
      title={name}
      >{name}</a
    >
  {/if}
{/snippet}

{#snippet splitCells(
  row: Row,
  split: Split
)}
  {@const amount = signedAmount(split, accountId)}
  {@const foreign = signedForeign(split, accountId)}
  {@const wide = opened.has(row.key)}
  <td class="min-w-0 {row.kind === "split" ? "pl-6" : ""}">
    <div class="flex min-w-0 items-center gap-1.5">
      {#if split.reconciled}
        <Check aria-label="Reconciled" class="size-3.5 shrink-0 text-income" />
      {/if}
      {#if split.has_attachments}
        <Paperclip
          aria-label="Has attachments"
          class="size-3.5 shrink-0 text-cladd-fg-soft"
        />
      {/if}
      <a
        class="min-w-0 hover:underline {wide ? "break-words" : "truncate"}"
        href={showUrl(row.group.id)}
        title={split.description}
        >{split.description}</a
      >
      {#if split.notes && !(wide || ui.notes)}
        <button
          aria-label="Show notes"
          class="grid size-4 shrink-0 place-items-center rounded text-cladd-fg-softer hover:bg-cladd-surface-next hover:text-cladd-fg"
          onclick={(event) => {
            event.stopPropagation();
            opened = toggled(opened, row.key, true);
          }}
          title={split.notes}
          type="button"
        >
          <NotebookText class="size-3" />
        </button>
      {/if}
      {#if split.tags?.length}
        <span
          class="ml-auto max-w-[45%] shrink-0 truncate text-[12px] 2xl:hidden"
          >{@render tagLinks(split.tags)}</span
        >
      {/if}
    </div>
    {#if split.notes && (wide || ui.notes)}
      <div
        class="flex min-w-0 items-start gap-0.5 text-[12px] text-cladd-fg-soft"
      >
        <button
          aria-expanded={wide}
          aria-label={wide ? "Collapse notes" : "Expand notes"}
          class="-ml-0.5 grid size-4 shrink-0 place-items-center rounded hover:bg-cladd-surface-next hover:text-cladd-fg"
          onclick={(event) => {
            event.stopPropagation();
            opened = toggled(opened, row.key, !wide);
          }}
          type="button"
        >
          <ChevronRight
            class="size-3 transition-transform {wide ? "rotate-90" : ""}"
          />
        </button>
        <span
          class="min-w-0 {wide
            ? "whitespace-pre-line break-words"
            : "truncate"}"
          >{split.notes}</span
        >
      </div>
    {/if}
  </td>
  <td class="text-right">
    {@render money(
      display.active && foreign?.code === display.code ? foreign : amount
    )}
    {#if foreign}
      <div class="num text-[12px] text-cladd-fg-soft lg:hidden">
        {formatMoney(foreign)}
      </div>
    {/if}
  </td>
  <td class="num text-right text-[12px] text-cladd-fg-soft max-lg:hidden">
    {#if foreign}
      {formatMoney(foreign)}
    {/if}
  </td>
  {#if accountId}
    <td class="text-right">{@render plain(balanceAfter(split, accountId))}</td>
  {/if}
  <td class="num text-cladd-fg-soft">
    {#if row.kind !== "split"}
      {@render day(split.date)}
    {/if}
  </td>
  <td class="max-md:hidden">
    {@render account(split.source_id, split.source_name, split.source_type)}
  </td>
  <td class="max-md:hidden">
    {@render account(
      split.destination_id,
      split.destination_name,
      split.destination_type
    )}
  </td>
  <td class="truncate max-lg:hidden">
    {#if split.category_id}
      <a class="hover:underline" href={`/categories/show/${split.category_id}`}
        >{split.category_name}</a
      >
    {/if}
  </td>
  <td class="truncate max-xl:hidden">
    {#if split.budget_id}
      <a class="hover:underline" href={`/budgets/show/${split.budget_id}`}
        >{split.budget_name}</a
      >
    {/if}
  </td>
  <td class="max-2xl:hidden {wide ? "" : "truncate"}">
    {@render tagLinks(split.tags)}
  </td>
{/snippet}

{#snippet blockRow(
  block: Block
)}
  {@const all = block.keys.every((key) => nav.selected.has(key))}
  <tr
    class="border-cladd-outline border-t bg-cladd-surface-next [&>td]:px-2 [&>td]:py-1"
  >
    {#if selectable}
      <td class="max-sm:hidden">
        <input
          aria-label={`Select ${block.label}`}
          checked={all}
          class={CHECKBOX}
          onclick={(event) => {
            event.currentTarget.blur();
            selectKeys(block.keys, !all);
          }}
          type="checkbox"
        >
      </td>
    {/if}
    <td class="max-sm:hidden"></td>
    <td class="min-w-0">
      <div class="flex min-w-0 items-center gap-2">
        {#if block.href}
          <a class="truncate font-semibold hover:underline" href={block.href}
            >{block.label}</a
          >
        {:else}
          <span class="truncate font-semibold">{block.label}</span>
        {/if}
        <span class="num shrink-0 text-[12px] text-cladd-fg-soft"
          >{block.groups.length}</span
        >
      </div>
      {#if block.actions?.length}
        <div class="mt-1 flex flex-wrap items-center gap-2">
          {#each block.actions as item (item.label)}
            {#if item.confirm}
              <ConfirmButton onconfirm={item.run}>{item.label}</ConfirmButton>
            {:else}
              <button
                class="inline-flex h-cladd-sm items-center rounded-cladd-sm px-2 text-[12px] text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg"
                onclick={item.run}
                type="button"
              >
                {item.label}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </td>
    <td class="text-right font-semibold">
      {#each block.sums as parts (parts[0]?.tone)}
        <div>{@render sum(parts)}</div>
      {/each}
    </td>
    <td class="max-lg:hidden"></td>
    {#if accountId}
      <td></td>
    {/if}
    <td></td>
    <td class="max-md:hidden"></td>
    <td class="max-md:hidden"></td>
    <td class="max-lg:hidden"></td>
    <td class="max-xl:hidden"></td>
    <td class="max-2xl:hidden"></td>
  </tr>
{/snippet}

{#snippet headCells(
  row: Row
)}
  {@const splits = row.group.attributes.transactions}
  {@const folded = collapsed.has(row.group.id)}
  {@const source = common(splits, (s) => s.source_id)}
  {@const destination = common(splits, (s) => s.destination_id)}
  {@const sums = sumByCurrency(splits, accountId)}
  <td class="min-w-0">
    <div class="flex min-w-0 items-center gap-1">
      <button
        aria-expanded={!folded}
        aria-label={folded ? "Show splits" : "Hide splits"}
        class="-ml-1 grid size-5 shrink-0 place-items-center rounded hover:bg-cladd-surface-next"
        onclick={(event) => {
          event.stopPropagation();
          collapsed = toggled(collapsed, row.group.id, !folded);
        }}
        type="button"
      >
        <ChevronRight
          class="size-3.5 transition-transform {folded ? "" : "rotate-90"}"
        />
      </button>
      <a
        class="truncate font-semibold hover:underline"
        href={showUrl(row.group.id)}
        >{row.group.attributes.group_title || splits[0]?.description}</a
      >
      <span class="shrink-0 text-[12px] text-cladd-fg-softer"
        >{row.count}
        splits</span
      >
    </div>
  </td>
  <td class="text-right font-semibold">
    {@render sum(sums)}
  </td>
  <td class="max-lg:hidden"></td>
  {#if accountId}
    <td></td>
  {/if}
  <td class="num text-cladd-fg-soft">
    {@render day(splits[0]?.date)}
  </td>
  <td class="max-md:hidden">
    {#if source}
      {@render account(source, splits[0].source_name, splits[0].source_type)}
    {/if}
  </td>
  <td class="max-md:hidden">
    {#if destination}
      {@render account(
        destination,
        splits[0].destination_name,
        splits[0].destination_type
      )}
    {/if}
  </td>
  <td class="max-lg:hidden"></td>
  <td class="max-xl:hidden"></td>
  <td class="max-2xl:hidden"></td>
{/snippet}

<div>
  <div
    class="sticky top-12 z-20 bg-cladd-surface"
    bind:clientHeight={barHeight}
  >
    <ActionBar
      onclear={() => nav.clear()}
      selected={nav.selected.size}
      targets={nav.targets}
      bind:this={bar}
    />
  </div>
  <ContextMenu>
    <ContextMenuTrigger class="block outline-none" {oncontextmenu}>
      <table class="w-full table-fixed border-collapse text-[13px]">
        <thead
          class="sticky z-10 bg-cladd-surface"
          style:top={`calc(3rem + ${barHeight}px)`}
        >
          <tr
            class="border-cladd-outline border-b text-left text-[12px] text-cladd-fg-soft [&>th]:h-8 [&>th]:truncate [&>th]:px-2 [&>th]:font-medium"
          >
            {#if selectable}
              <th class="w-8 max-sm:hidden">
                <input
                  aria-label="Select all"
                  checked={rows.length > 0 && nav.selected.size === rows.length}
                  class={CHECKBOX}
                  onclick={(event) => {
                    event.currentTarget.blur();
                    nav.selectAll();
                  }}
                  type="checkbox"
                >
              </th>
            {/if}
            <th class="w-6 max-sm:hidden"><span class="sr-only">Type</span></th>
            <th>
              Description
              <button
                aria-pressed={ui.notes}
                class="ml-1 inline-grid size-5 place-items-center rounded align-middle hover:bg-cladd-surface-next hover:text-cladd-fg {ui.notes
                  ? "text-cladd-fg"
                  : "text-cladd-fg-softer"}"
                onclick={() => ui.toggleNotes()}
                title={ui.notes ? "Hide notes (i)" : "Show notes (i)"}
                type="button"
              >
                <NotebookText class="size-3.5" />
              </button>
            </th>
            <th class="w-28 text-right md:w-32">Amount</th>
            <th class="w-24 text-right max-lg:hidden">Foreign</th>
            {#if accountId}
              <th class="w-32 text-right">Balance</th>
            {/if}
            <th class="w-16 md:w-[6.5rem]">Date</th>
            <th class="w-34 max-md:hidden">Source account</th>
            <th class="w-34 max-md:hidden">Destination account</th>
            <th class="w-28 max-lg:hidden">Category</th>
            <th class="w-24 max-xl:hidden">Budget</th>
            <th class="w-28 max-2xl:hidden">Tags</th>
          </tr>
        </thead>
        <tbody class={loading && rows.length > 0 ? "opacity-60" : ""}>
          {#each rows as row, index (row.key)}
            {@const block = blocks.get(index)}
            {#if block}
              {@render blockRow(block)}
            {/if}
            <tr
              class="align-top [&>td]:px-2 [&>td]:py-1 {rowClass(row, index)}"
              data-index={index}
              id={nav.rowId(index)}
              onclick={(event) => nav.click(index, event)}
              ondblclick={() => open(row)}
              style:scroll-margin-top={`${barHeight + HEAD_HEIGHT}px`}
            >
              {#if selectable}
                <td class="max-sm:hidden">
                  <input
                    aria-label="Select row"
                    checked={nav.isSelected(row)}
                    class={CHECKBOX}
                    onclick={(event) => {
                      event.stopPropagation();
                      event.currentTarget.blur();
                      nav.toggle(row);
                    }}
                    type="checkbox"
                  >
                </td>
              {/if}
              <td class="pt-1.5! max-sm:hidden">
                {#if row.kind !== "split"}
                  <TypeIcon type={groupType(row.group)} />
                {/if}
              </td>
              {#if row.split}
                {@render splitCells(row, row.split)}
              {:else}
                {@render headCells(row)}
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if rows.length === 0}
        <p class="px-3 py-6 text-center text-cladd-fg-soft">
          {loading ? "Loading transactions..." : empty}
        </p>
      {/if}
    </ContextMenuTrigger>
    <ContextMenuContent class="w-60">
      {#if menuRows.length > 0}
        {@const first = menuRows[0]}
        <ContextMenuItem onSelect={() => open(first)}>
          Open <ContextMenuShortcut>↵</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => goto(editUrl(first.group.id))}>
          Edit <ContextMenuShortcut>e</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => goto(cloneUrl(first.group))}>
          Clone <ContextMenuShortcut>c</ContextMenuShortcut>
        </ContextMenuItem>
        {#if selectable}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => bar?.start("category", menuRows)}>
            Set category... <ContextMenuShortcut>s c</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => bar?.start("budget", menuRows)}>
            Set budget... <ContextMenuShortcut>s b</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => bar?.start("bill", menuRows)}>
            Set subscription... <ContextMenuShortcut>s s</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => bar?.start("tag", menuRows)}>
            Add tag... <ContextMenuShortcut>s t</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => bar?.start("untag", menuRows)}>
            Remove tag... <ContextMenuShortcut>s T</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={(event) => {
              if (menuArmed) {
                bar?.remove(menuRows, true);
                return;
              }
              event.preventDefault();
              menuArmed = true;
            }}
            variant="destructive"
          >
            {menuArmed ? "Press again to delete" : "Delete"}
            {menuRows.length > 1 ? `${menuRows.length} transactions` : ""}
            <ContextMenuShortcut>d</ContextMenuShortcut>
          </ContextMenuItem>
        {/if}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => oldUi(first)}>
          Open in old UI
        </ContextMenuItem>
      {:else}
        <ContextMenuItem disabled>Right-click a row</ContextMenuItem>
      {/if}
    </ContextMenuContent>
  </ContextMenu>
</div>
