<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Funnel from "@lucide/svelte/icons/funnel";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import { DropdownMenu } from "bits-ui";
  import DropdownMenuCheckboxItem from "#lib/components/ui/dropdown-menu/dropdown-menu-checkbox-item.svelte";
  import DropdownMenuContent from "#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte";
  import DropdownMenuItem from "#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte";
  import DropdownMenuRadioGroup from "#lib/components/ui/dropdown-menu/dropdown-menu-radio-group.svelte";
  import DropdownMenuRadioItem from "#lib/components/ui/dropdown-menu/dropdown-menu-radio-item.svelte";
  import DropdownMenuSeparator from "#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import {
    type Count,
    countFacets,
    FACETS,
    type FacetId,
    GROUP_BY,
    GROUP_LABEL,
    type GroupBy,
    isFiltered,
    toggleValue,
    valueLabel,
  } from "#lib/transactions/ledger.js";
  import type { LedgerView } from "#lib/transactions/ledger-view.svelte.js";
  import type { Group } from "#lib/transactions/split.js";

  interface Option extends Count {
    facet: string;
    id: FacetId;
  }

  const NOTE_MS = 4000;
  const SUGGESTIONS = 6;
  const LABEL = Object.fromEntries(FACETS.map((f) => [f.id, f.label]));
  const TRIGGER =
    "inline-flex h-7 shrink-0 items-center gap-1 rounded-cladd-sm px-2 text-[12px] hover:bg-row-hover hover:text-cladd-fg data-[state=open]:bg-row-hover";
  const ITEM =
    "min-h-7 gap-3 rounded-cladd-sm py-0.5 ps-9 pe-2 font-normal text-[13px]";
  const LINK = "inline-flex items-center gap-1.5 hover:text-cladd-fg";

  let {
    view,
    groups,
    keep,
    ids,
    shown,
    total,
    duplicates,
    onsearch,
  }: {
    view: LedgerView;
    groups: Group[];
    keep: (group: Group) => boolean;
    ids: FacetId[];
    shown: number;
    total: number;
    duplicates: number;
    onsearch: () => void;
  } = $props();

  let input = $state<HTMLInputElement>();
  let focused = $state(false);
  let cursor = $state(-1);
  let note = $state("");
  let noteTimer: ReturnType<typeof setTimeout> | undefined;

  const filters = $derived(view.filters);
  const typed = $derived(filters.text.trim());
  const counts = $derived(countFacets(groups, filters, ids, keep));
  const options = $derived.by<Option[]>(() => {
    if (!(typed && focused)) {
      return [];
    }
    const loose = countFacets(groups, { ...filters, text: "" }, ids, keep);
    return [...loose].flatMap(([id, list]) =>
      list
        .filter((c) => c.count > 0 && !filters.facets[id]?.includes(c.key))
        .map((c) => ({ ...c, facet: LABEL[id], id }))
    );
  });
  const suggestions = $derived(
    fuzzyFilter(options, typed, (o) => `${o.label} ${o.facet}`, SUGGESTIONS)
  );
  const open = $derived(focused && typed !== "");
  const nextGroup = $derived(
    [null, ...GROUP_BY][
      (GROUP_BY.indexOf(filters.group as GroupBy) + 2) % (GROUP_BY.length + 1)
    ]
  );

  function focus() {
    input?.focus();
    input?.select();
  }

  function say(message: string) {
    note = message;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note = ""), NOTE_MS);
  }

  function choose(option: Option | undefined) {
    if (!option) {
      return;
    }
    view.set({
      ...toggleValue(filters, option.id, option.key, true),
      text: "",
    });
    input?.blur();
  }

  function onkeydown(event: KeyboardEvent) {
    const count = suggestions.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      cursor = ((cursor + 1 + step + count + 1) % (count + 1)) - 1;
    } else if (event.key === "Tab" && !event.shiftKey && count > 0) {
      event.preventDefault();
      choose(suggestions[Math.max(cursor, 0)]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (cursor >= 0) {
        choose(suggestions[cursor]);
      } else if (typed) {
        onsearch();
      }
    }
  }

  function summary(id: FacetId, keys: string[]) {
    return keys.length === 1
      ? valueLabel(id, keys[0])
      : `${keys.length} values`;
  }

  function setGroup(value: string) {
    view.set({
      ...filters,
      group: GROUP_BY.includes(value as GroupBy) ? (value as GroupBy) : null,
    });
  }

  useKeys(() => [
    { group: "Filter", keys: "f", label: "Filter this list", run: focus },
    { group: "Filter", keys: "/", label: "Filter this list", run: focus },
    {
      group: "Filter",
      keys: "F",
      label: "Clear filters",
      run: () => view.clear(),
    },
    {
      group: "Filter",
      keys: ";",
      label: `Group by ${nextGroup ? GROUP_LABEL[nextGroup].toLowerCase() : "nothing"}`,
      run: () => view.cycleGroup(),
    },
    {
      group: "Filter",
      keys: "P",
      label: view.pinned >= 0 ? "Unpin this filter" : "Pin this filter",
      run: () => say(view.togglePin()),
    },
    ...view.pins.map((pin, index) => ({
      group: "Pinned filters",
      keys: String(index + 1),
      label: `Filter: ${pin.label}`,
      run: () => view.apply(pin),
    })),
  ]);
</script>

{#snippet facetMenu(
  id: FacetId
)}
  {@const values = counts.get(id) ?? []}
  {@const selected = filters.facets[id] ?? []}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger
      class="{TRIGGER} {selected.length
        ? "text-cladd-fg"
        : "text-cladd-fg-soft"}"
    >
      {#if selected.length}
        <Funnel class="size-3 text-brand" />
        {LABEL[id]}:
        <span class="max-w-40 truncate font-semibold"
          >{summary(id, selected)}</span
        >
      {:else}
        {LABEL[id]}
      {/if}
      <ChevronDown class="size-3 opacity-60" />
    </DropdownMenu.Trigger>
    <DropdownMenuContent align="start" class="w-72 p-1">
      {#if selected.length}
        <DropdownMenuItem
          class={ITEM}
          onSelect={() =>
            view.set({ ...filters, facets: { ...filters.facets, [id]: [] } })}
        >
          Clear this filter
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      {/if}
      {#each values as value (value.key)}
        <DropdownMenuCheckboxItem
          checked={selected.includes(value.key)}
          class={ITEM}
          closeOnSelect={false}
          onCheckedChange={(on) =>
            view.set(toggleValue(filters, id, value.key, on))}
          textValue={value.label}
        >
          <span class="min-w-0 flex-1 truncate">{value.label}</span>
          <span class="num text-[12px] text-cladd-fg-soft">{value.count}</span>
        </DropdownMenuCheckboxItem>
      {:else}
        <p class="px-2 py-1 text-cladd-fg-soft">Nothing to filter by</p>
      {/each}
    </DropdownMenuContent>
  </DropdownMenu.Root>
{/snippet}

<div class="flex flex-col gap-1 border-cladd-outline border-b px-2 pt-2 pb-1.5">
  <div class="flex flex-wrap items-center gap-1">
    <div class="relative w-64 max-md:w-full">
      <Search
        class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-cladd-fg-softer"
      />
      <input
        aria-activedescendant={open ? `ledger-filter-${cursor}` : undefined}
        aria-autocomplete="list"
        aria-controls="ledger-filter-list"
        aria-expanded={open}
        aria-label="Filter this list"
        autocomplete="off"
        class="cladd-cut cladd-focusable-input h-7 w-full rounded-cladd-md pr-2 pl-7 text-[13px] text-cladd-fg placeholder:text-cladd-fg-softer"
        id="ledger-filter"
        onblur={() => (focused = false)}
        onfocus={() => (focused = true)}
        oninput={(event) => {
          cursor = -1;
          view.type(event.currentTarget.value);
        }}
        {onkeydown}
        placeholder="Filter: text, amount, >100"
        role="combobox"
        spellcheck="false"
        value={view.text}
        bind:this={input}
      >
      {#if open}
        <div
          class="cladd-surface cladd-outline absolute top-full left-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-cladd-md p-1 shadow-cladd-popover"
          id="ledger-filter-list"
          role="listbox"
        >
          <div
            aria-selected={cursor === -1}
            class="flex h-7 cursor-pointer items-center gap-2 rounded-cladd-sm px-2 {cursor ===
            -1
              ? "bg-row-cursor"
              : "hover:bg-row-hover"}"
            id="ledger-filter--1"
            onmousedown={(event) => {
              event.preventDefault();
              onsearch();
            }}
            role="option"
            tabindex="-1"
          >
            <span class="min-w-0 flex-1 truncate"
              >Search Firefly for “{typed}”</span
            >
            <span class="kbd">↵</span>
          </div>
          {#each suggestions as option, index (`${option.id}:${option.key}`)}
            <div
              aria-selected={index === cursor}
              class="flex h-7 cursor-pointer items-center gap-2 rounded-cladd-sm px-2 {index ===
              cursor
                ? "bg-row-cursor"
                : "hover:bg-row-hover"}"
              id={`ledger-filter-${index}`}
              onmousedown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              role="option"
              tabindex="-1"
            >
              <span class="w-22 shrink-0 text-[12px] text-cladd-fg-soft"
                >{option.facet}</span
              >
              <span class="min-w-0 flex-1 truncate">{option.label}</span>
              <span class="num text-[12px] text-cladd-fg-soft"
                >{option.count}</span
              >
              {#if index === Math.max(cursor, 0)}
                <span class="kbd">Tab</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div
      class="flex min-w-0 items-center max-md:-mx-2 max-md:w-[calc(100%+1rem)] max-md:overflow-x-auto max-md:px-1 md:flex-wrap"
    >
      {#each ids as id (id)}
        {@render facetMenu(id)}
      {/each}
      {#if duplicates > 0 || filters.dupes}
        <button
          aria-pressed={filters.dupes}
          class="{TRIGGER} {filters.dupes ? "text-cladd-fg" : "text-warn"}"
          onclick={() => view.set({ ...filters, dupes: !filters.dupes })}
          type="button"
        >
          {#if filters.dupes}
            <Funnel class="size-3 text-brand" />
          {/if}
          Possible duplicates
          <span class="num font-semibold">{duplicates}</span>
        </button>
      {/if}
    </div>
  </div>
  <div
    class="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12px] text-cladd-fg-soft"
  >
    {#each view.pins as pin, index (pin.query)}
      {@const active = index === view.pinned}
      <span class="inline-flex items-center gap-0.5">
        <button
          aria-label={`Filter: ${pin.label}`}
          aria-pressed={active}
          class="{LINK} {active ? "font-semibold text-cladd-fg" : ""}"
          onclick={() => view.apply(pin)}
          type="button"
        >
          <span class="kbd max-md:hidden">{index + 1}</span>
          {pin.label}
        </button>
        <button
          aria-label={`Unpin ${pin.label}`}
          class="grid size-4 place-items-center rounded text-cladd-fg-softer hover:bg-row-hover hover:text-cladd-fg"
          onclick={() => view.unpin(pin)}
          type="button"
        >
          <X class="size-3" />
        </button>
      </span>
    {/each}
    <span class="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
      <span aria-live="polite">{note}</span>
      <span class="flex items-center gap-0.5">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class="{TRIGGER} {filters.group
              ? "text-cladd-fg"
              : "text-cladd-fg-soft"}"
          >
            Group by:
            <span class="font-semibold"
              >{filters.group ? GROUP_LABEL[filters.group] : "None"}</span
            >
            <ChevronDown class="size-3 opacity-60" />
          </DropdownMenu.Trigger>
          <DropdownMenuContent align="end" class="w-44 p-1">
            <DropdownMenuRadioGroup
              onValueChange={setGroup}
              value={filters.group ?? "none"}
            >
              <DropdownMenuRadioItem class={ITEM} value="none"
                >None</DropdownMenuRadioItem
              >
              {#each GROUP_BY as value (value)}
                <DropdownMenuRadioItem class={ITEM} {value}
                  >{GROUP_LABEL[value]}</DropdownMenuRadioItem
                >
              {/each}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu.Root>
        <span class="kbd max-md:hidden">;</span>
      </span>
      <span class="num text-cladd-fg" id="ledger-count">
        {#if isFiltered(filters)}
          <strong>{shown}</strong>
          of {total}
        {:else}
          {total}
          {total === 1 ? "transaction" : "transactions"}
        {/if}
      </span>
      {#if isFiltered(filters)}
        <button class={LINK} onclick={() => view.clear()} type="button">
          Clear <span class="kbd max-md:hidden">F</span>
        </button>
        <button
          class={LINK}
          onclick={() => say(view.togglePin())}
          type="button"
        >
          {view.pinned >= 0 ? "Unpin" : "Pin"}
          <span class="kbd max-md:hidden">P</span>
        </button>
      {/if}
    </span>
  </div>
</div>
