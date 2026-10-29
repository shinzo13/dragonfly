<script lang="ts">
  import { untrack } from "svelte";
  import {
    applyPatch,
    type Entry,
    type Option,
    type Place,
    samplesOf,
    storedSet,
    sumsOf,
    targetsOf,
  } from "#lib/budgets/triage.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import MoneyList from "#lib/components/categories/MoneyList.svelte";
  import AutocompleteInput, {
    type Option as Choice,
  } from "#lib/components/inputs/AutocompleteInput.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { formatDate } from "#lib/format.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { type Binding, useKeys } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import type { Patch, Targets } from "#lib/transactions/mass.js";
  import { showUrl } from "#lib/transactions/split.js";
  import { goto } from "$app/navigation";

  const DIGITS = 9;
  const REFRESH_MS = 800;

  interface Row {
    entry?: Entry;
    key: string;
    place: Place;
  }

  interface Action {
    done: number;
    entries: string[];
    error: string;
    forget?: () => void;
    kind: "move" | "ignore";
    label: string;
    row: string;
    state: "busy" | "undoing" | "done";
    targets: Targets;
  }

  let {
    title,
    noun,
    places,
    loading,
    problem = "",
    empty,
    options,
    pickKey,
    active,
    everything,
    periodLabel,
    ignoreKey,
    assignPatch,
    clearPatch,
    create,
    onassign,
    hint,
    onswitch,
    onactivate,
    onleave,
    onchange,
  }: {
    title: string;
    noun: string;
    places: Place[];
    loading: boolean;
    problem?: string;
    empty: string;
    options: Option[];
    pickKey: string;
    active: boolean;
    everything: boolean;
    periodLabel: string;
    ignoreKey: string;
    assignPatch: (id: string) => Patch;
    clearPatch: Patch;
    create: (name: string) => Promise<Option>;
    onassign?: (place: Place, option: Option) => () => void;
    hint?: (place: Place) => string | null;
    onswitch: () => void;
    onactivate: () => void;
    onleave: () => void;
    onchange: () => void;
  } = $props();

  const store = untrack(() => storedSet(ignoreKey));
  let ignored = $state(store.read());
  let expanded = $state(new Set<string>());
  let actions = $state<Action[]>([]);
  let picking = $state<string | null>(null);
  let pickText = $state("");
  let pickRef = $state<HTMLInputElement | null>(null);
  let pickError = $state("");
  let timer: ReturnType<typeof setTimeout> | undefined;

  const taken = $derived(new Set(actions.flatMap((action) => action.entries)));
  const latest = (key: string) =>
    [...actions].reverse().find((action) => action.row === key);
  const skipped = (place: Place) =>
    actions.some(
      (action) => action.kind === "ignore" && action.row === place.key
    );
  const left = (place: Place) =>
    place.entries.filter((entry) => !taken.has(entry.key));

  const shown = $derived(
    places.filter((place) => !ignored.has(place.key) || skipped(place))
  );
  const rows = $derived<Row[]>(
    shown.flatMap((place) => [
      { key: place.key, place },
      ...(expanded.has(place.key)
        ? place.entries.map((entry) => ({ entry, key: entry.key, place }))
        : []),
    ])
  );
  const open = $derived(
    shown.filter((place) => !skipped(place) && left(place).length > 0)
  );
  const openCount = $derived(
    open.reduce((sum, place) => sum + left(place).length, 0)
  );
  const hidden = $derived(
    places.filter((place) => ignored.has(place.key) && !skipped(place)).length
  );
  const numbered = $derived(options.slice(0, DIGITS));

  function settled(row: Row): boolean {
    if (row.entry) {
      return taken.has(row.entry.key) || skipped(row.place);
    }
    return skipped(row.place) || left(row.place).length === 0;
  }

  const indexOf = (key: string) => rows.findIndex((row) => row.key === key);
  const firstOpen = () =>
    Math.max(
      0,
      rows.findIndex((row) => !settled(row))
    );

  function nextOpen(from: Row): Row | undefined {
    const after = rows.slice(indexOf(from.key) + 1);
    return after.find(
      (row) =>
        !settled(row) &&
        (row.entry === undefined || (from.entry && row.place === from.place))
    );
  }

  function collapse(key: string) {
    if (expanded.has(key)) {
      const next = new Set(expanded);
      next.delete(key);
      expanded = next;
    }
  }

  function changed() {
    clearTimeout(timer);
    timer = setTimeout(onchange, REFRESH_MS);
  }

  function record(action: Action, from: Row) {
    actions = [...actions, action];
    picking = null;
    const next = nextOpen(from);
    if (!from.entry) {
      collapse(from.place.key);
    }
    if (next) {
      nav.move(indexOf(next.key));
    }
    return actions.at(-1) as Action;
  }

  async function assign(row: Row, option: Option) {
    if (settled(row)) {
      return;
    }
    const entries = row.entry ? [row.entry] : left(row.place);
    const targets = targetsOf(entries);
    const action = record(
      {
        done: 0,
        entries: entries.map((entry) => entry.key),
        error: "",
        forget: row.entry ? undefined : onassign?.(row.place, option),
        kind: "move",
        label: option.name,
        row: row.key,
        state: "busy",
        targets,
      },
      row
    );
    const errors = await applyPatch(targets, assignPatch(option.id), (done) => {
      action.done = done;
    });
    action.state = "done";
    action.error = errors[0] ?? "";
    changed();
  }

  function ignore(row: Row) {
    const { place } = row;
    if (skipped(place)) {
      return;
    }
    ignored = new Set([...ignored, place.key]);
    store.write(ignored);
    record(
      {
        done: 0,
        entries: [],
        error: "",
        kind: "ignore",
        label: "",
        row: place.key,
        state: "done",
        targets: new Map(),
      },
      { key: place.key, place }
    );
  }

  async function undo(action: Action | undefined) {
    if (action?.state !== "done") {
      return;
    }
    const at = indexOf(action.row);
    if (at >= 0) {
      nav.move(at);
    }
    if (action.kind === "ignore") {
      const next = new Set(ignored);
      next.delete(action.row);
      ignored = next;
      store.write(next);
      actions = actions.filter((item) => item !== action);
      return;
    }
    action.state = "undoing";
    action.done = 0;
    const errors = await applyPatch(action.targets, clearPatch, (done) => {
      action.done = done;
    });
    action.forget?.();
    if (errors.length > 0) {
      action.state = "done";
      action.error = errors[0];
    } else {
      actions = actions.filter((item) => item !== action);
    }
    changed();
  }

  const undoLast = () =>
    undo([...actions].reverse().find((action) => action.state === "done"));

  let shownScope = untrack(() => everything);
  $effect(() => {
    if (everything !== shownScope) {
      shownScope = everything;
      untrack(() => {
        nav.cursor = -1;
        expanded = new Set();
      });
    }
  });

  function toggle(row: Row) {
    const { key } = row.place;
    const next = new Set(expanded);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    expanded = next;
    nav.move(indexOf(row.entry && !next.has(key) ? key : row.key));
  }

  function startPick(row: Row) {
    if (settled(row)) {
      return;
    }
    pickText = "";
    pickError = "";
    picking = row.key;
  }

  $effect(() => {
    pickRef?.focus();
  });

  async function picked(row: Row, choice: Choice) {
    if (picking !== row.key) {
      return;
    }
    if (choice.id) {
      assign(row, { id: choice.id, name: choice.label });
      return;
    }
    try {
      assign(row, await create(choice.label));
    } catch (failure) {
      pickError = failure instanceof Error ? failure.message : String(failure);
    }
  }

  const search = (query: string): Choice[] =>
    fuzzyFilter(options, query, (option) => option.name, 40).map((option) => ({
      id: option.id,
      label: option.name,
    }));

  function show(row: Row) {
    if (row.entry) {
      goto(showUrl(row.entry.group.id));
    } else if (row.place.accountId) {
      goto(`/accounts/show/${row.place.accountId}`);
    }
  }

  const run = (action: (row: Row) => void) => () => {
    const row = nav.current;
    if (row) {
      action(row);
    }
  };

  const group = $derived(
    `Sort into ${noun === "budget" ? "budgets" : "categories"}`
  );

  function bindings(): Binding[] {
    return [
      ...numbered.map((option, i) => ({
        group,
        keys: String(i + 1),
        label: `Move to ${option.name}`,
        run: run((row) => assign(row, option)),
      })),
      {
        group,
        keys: pickKey,
        label: `Move to another ${noun}`,
        run: run(startPick),
      },
      { group, keys: "n", label: "Ignore this place", run: run(ignore) },
      { group, keys: "u", label: "Undo the last move", run: undoLast },
      {
        group,
        keys: "Enter",
        label: "Show or hide the transactions",
        run: run(toggle),
      },
      { group, keys: "o", label: "Open", run: run(show) },
      {
        group,
        keys: "v",
        label: `Switch between ${periodLabel} and everything`,
        run: onswitch,
      },
      { group, keys: "Escape", label: "Stop sorting", run: onleave },
    ];
  }

  const nav: ListNav<Row> = new ListNav<Row>({
    extra: bindings,
    id: "triage",
    items: () => rows,
    key: (row) => row.key,
  });
  useKeys(() => (active ? nav.bindings() : []));

  const ready = $derived(rows.length > 0);
  const lost = $derived(nav.cursor < 0 || nav.cursor >= rows.length);

  $effect(() => {
    if (active && ready && lost) {
      untrack(() => nav.move(firstOpen()));
    }
  });

  $effect(() => {
    if (active) {
      untrack(() => nav.reveal("nearest"));
    }
  });

  function click(index: number, event: MouseEvent) {
    nav.click(index, event);
    onactivate();
  }

  function unignore() {
    ignored = new Set();
    store.write(ignored);
  }
</script>

<Box
  body="p-0"
  class="mt-4"
  footer={hidden > 0 ? ignoredNote : undefined}
  {title}
>
  <div
    class="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 border-cladd-outline border-b px-3 py-2"
  >
    <p class="text-[14px] text-cladd-fg">
      {#if loading}
        <span class="text-cladd-fg-soft">Loading</span>
      {:else if openCount === 0}
        {empty}
      {:else}
        <span class="num font-semibold">{openCount}</span>
        {openCount === 1 ? "transaction" : "transactions"}
        in <span class="num font-semibold">{open.length}</span>
        {open.length === 1 ? "place" : "places"}
        {noun === "budget" ? "have no budget" : "have no category"}
      {/if}
    </p>
    <div class="ml-auto flex items-center gap-2">
      <fieldset
        aria-label="Which transactions"
        class="cladd-cut flex h-7 items-center gap-0.5 rounded-cladd-sm p-0.5"
      >
        {#each [false, true] as all (all)}
          <button
            aria-pressed={everything === all}
            class="h-6 rounded-[5px] px-2 text-[12px] {everything === all
              ? "cladd-surface cladd-outline font-semibold text-cladd-fg"
              : "text-cladd-fg-soft hover:text-cladd-fg"}"
            onclick={() => everything !== all && onswitch()}
            title="Switch with v"
            type="button"
          >
            {all ? "Everything" : periodLabel}
          </button>
        {/each}
      </fieldset>
      {#if openCount > 0}
        {#if active}
          <Button onclick={onleave} size="sm" variant="outline">
            Stop sorting <span class="kbd">Esc</span>
          </Button>
        {:else}
          <Button onclick={onactivate} size="sm">
            Sort them <span class="kbd">t</span>
          </Button>
        {/if}
      {/if}
    </div>
  </div>

  {#if problem}
    <p class="px-3 py-3 text-expense">{problem}</p>
  {:else if rows.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full text-[13px]">
        <thead>
          <tr
            class="h-8 border-cladd-outline border-b text-left text-[12px] text-cladd-fg-soft"
          >
            <th class="px-3 font-medium sm:w-[26%]">Place</th>
            <th class="px-3 text-right font-medium sm:w-16">Count</th>
            <th class="px-3 text-right font-medium sm:w-[14%]">Amount</th>
            <th class="px-3 font-medium max-md:hidden">For example</th>
            <th class="w-[22%] px-3 max-sm:hidden"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i (row.key)}
            {@const done = settled(row)}
            {@const cursor = active && nav.cursor === i}
            <tr
              class="h-8 scroll-mb-14 border-cladd-outline border-b {cursor
                ? "bg-row-cursor"
                : "hover:bg-row-hover"} {done ? "text-cladd-fg-softer" : ""}"
              id={nav.rowId(i)}
              onclick={(event) => click(i, event)}
            >
              {#if row.entry}
                {@const split = row.entry.split}
                <td class="py-1 pr-3 pl-8">
                  <span class={done ? "" : "text-cladd-fg"}
                    >{split.description}</span
                  >
                  {@render result(row, "sm:hidden")}
                </td>
                <td class="num px-3 text-right text-cladd-fg-soft">
                  {formatDate(split.date, "short")}
                </td>
                <td class="px-3 text-right">
                  <Amount
                    amount={split.type === "withdrawal"
                      ? -Number(split.amount)
                      : split.amount}
                    code={split.currency_code}
                    decimals={split.currency_decimal_places}
                    symbol={split.currency_symbol}
                    tone={done ? "neutral" : "auto"}
                  />
                </td>
                <td
                  class="max-w-0 truncate px-3 text-cladd-fg-soft max-md:hidden"
                >
                  {split.type === "withdrawal" ? "from" : "to"}
                  {split.type === "withdrawal"
                    ? split.source_name
                    : split.destination_name}
                </td>
              {:else}
                {@const rest = done ? row.place.entries : left(row.place)}
                <td class="py-1 pr-3 pl-3">
                  <span class="font-medium {done ? "" : "text-cladd-fg"}"
                    >{row.place.name || "(no name)"}</span
                  >
                  {@render result(row, "sm:hidden")}
                </td>
                <td class="num px-3 text-right">{rest.length}</td>
                <td class="px-3 text-right">
                  <MoneyList
                    sums={sumsOf(rest)}
                    tone={done ? "neutral" : "auto"}
                  />
                </td>
                <td
                  class="max-w-0 truncate px-3 text-cladd-fg-soft max-md:hidden"
                >
                  {samplesOf(rest).join(", ")}
                </td>
              {/if}
              <td class="px-3 max-sm:hidden">{@render result(row, "")}</td>
            </tr>
            {#if cursor && !done}
              <tr class="border-cladd-outline border-b bg-row-cursor/40">
                <td class="px-3 py-2" colspan="5">
                  {@render strip(row)}
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Box>

{#snippet ignoredNote()}
  <span class="text-cladd-fg-soft"
    >{hidden}
    {hidden === 1 ? "place is" : "places are"}
    ignored.</span
  >
  <button class="text-brand hover:underline" onclick={unignore} type="button">
    Show them again
  </button>
{/snippet}

{#snippet result(
  row: Row,
  extra: string
)}
  {@const item = latest(row.key)}
  {#if item}
    <div class="flex flex-wrap items-center gap-x-2 text-[12px] {extra}">
      {#if item.state !== "done"}
        <span class="num text-cladd-fg-soft"
          >{item.state === "undoing"
            ? "Putting back"
            : `Moving to ${item.label}`}
          {item.done}
          of {item.targets.size}</span
        >
      {:else}
        <span class="text-cladd-fg">
          {item.kind === "ignore"
            ? "Ignored"
            : `${item.entries.length} moved to ${item.label}`}
        </span>
        {#if item.error}
          <span class="text-expense">{item.error}</span>
        {/if}
        <button
          class="text-brand hover:underline"
          onclick={(event) => {
            event.stopPropagation();
            undo(item);
          }}
          type="button"
        >
          Undo
        </button>
      {/if}
    </div>
  {:else if !row.entry && hint?.(row.place)}
    <div class="text-[12px] text-cladd-fg-soft {extra}">
      Usually {hint(row.place)}
    </div>
  {/if}
{/snippet}

{#snippet strip(
  row: Row
)}
  {@const count = row.entry ? 1 : left(row.place).length}
  {#if picking === row.key}
    <div class="flex flex-wrap items-center gap-2">
      <AutocompleteInput
        aria-label="Pick a {noun}"
        class="w-72 max-w-full"
        free
        onblur={() => (picking = null)}
        onkeydown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            picking = null;
            nav.move(nav.cursor);
          }
        }}
        onpick={(choice) => picked(row, choice)}
        openOnFocus
        placeholder="Type a {noun} name"
        {search}
        bind:ref={pickRef}
        bind:value={pickText}
      />
      <span class="text-[12px] text-cladd-fg-soft"
        ><span class="kbd">↵</span>
        moves, a new name creates the {noun}</span
      >
      {#if pickError}
        <span class="text-[12px] text-expense">{pickError}</span>
      {/if}
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="mr-1 text-cladd-fg-soft"
        >Move {count === 1 ? "it" : `all ${count}`} to</span
      >
      {#each numbered as option, n (option.id)}
        <Button onclick={() => assign(row, option)} size="sm" variant="outline">
          <span class="kbd">{n + 1}</span>{option.name}
        </Button>
      {/each}
      <Button onclick={() => startPick(row)} size="sm" variant="outline">
        <span class="kbd">{pickKey}</span>Another {noun}
      </Button>
      {#if !row.entry}
        <Button onclick={() => ignore(row)} size="sm" variant="ghost">
          <span class="kbd">n</span>Ignore
        </Button>
        <Button onclick={() => toggle(row)} size="sm" variant="ghost">
          <span class="kbd">↵</span>
          {expanded.has(row.place.key) ? "Hide" : "Show"}
          {count === 1 ? "it" : "them"}
        </Button>
      {/if}
    </div>
  {/if}
{/snippet}
