<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { invalidate, lists } from "#lib/api/lists.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import {
    deleteTargets,
    type MassAction,
    MODES,
    type Mode,
    type Outcome,
    patchFor,
    type Row,
    splitsOf,
    targetsOf,
    updateGroups,
  } from "#lib/transactions/mass.js";
  import type { Suggestion } from "#lib/transactions/query.js";
  import { lastAction } from "#lib/transactions/repeat.svelte.js";
  import SuggestInput from "./SuggestInput.svelte";

  const ARM_MS = 3000;
  const STATUS_MS = 8000;
  const NONE = "\u0000";
  const VERB = Object.fromEntries(MODES.map((m) => [m.mode, m.verb]));

  let {
    targets,
    selected,
    onclear,
  }: { targets: Row[]; selected: number; onclear: () => void } = $props();

  let mode = $state<Mode | null>(null);
  let active = $state<Row[]>([]);
  let text = $state("");
  let input = $state<HTMLInputElement>();
  let status = $state("");
  let busy = $state(false);
  let armed = $state(false);
  let armTimer: ReturnType<typeof setTimeout> | undefined;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const categories = createQuery(() => ({
    ...lists.categories(),
    enabled: mode === "category",
  }));
  const budgets = createQuery(() => ({
    ...lists.budgets(),
    enabled: mode === "budget",
  }));
  const tags = createQuery(() => ({
    ...lists.tags(),
    enabled: mode === "tag",
  }));
  const bills = createQuery(() => ({
    ...lists.bills(),
    enabled: mode === "bill",
  }));

  const visible = $derived(
    selected > 0 || mode !== null || armed || status !== ""
  );
  const count = $derived(targetsOf(mode || armed ? active : targets).size);

  function options(current: Mode | null): [string[], string | null, boolean] {
    switch (current) {
      case "category":
        return [
          (categories.data ?? []).map((c) => c.attributes.name),
          "(no category)",
          true,
        ];
      case "budget":
        return [
          (budgets.data ?? [])
            .filter((b) => b.attributes.active !== false)
            .map((b) => b.attributes.name),
          "(no budget)",
          false,
        ];
      case "bill":
        return [
          (bills.data ?? [])
            .filter((b) => b.attributes.active !== false)
            .map((b) => b.attributes.name ?? ""),
          "(no subscription)",
          false,
        ];
      case "tag":
        return [(tags.data ?? []).map((t) => t.attributes.tag), null, true];
      case "untag":
        return [
          [...new Set(splitsOf(active).flatMap((s) => s.tags ?? []))],
          null,
          false,
        ];
      default:
        return [[], null, false];
    }
  }

  const suggestions = $derived.by<Suggestion[]>(() => {
    const [names, none, free] = options(mode);
    const query = text.trim();
    const found: Suggestion[] = fuzzyFilter(names, query, (n) => n, 8).map(
      (name) => ({ id: name, insert: name, label: name })
    );
    const exact = names.some((n) => n.toLowerCase() === query.toLowerCase());
    if (free && query && !exact) {
      found.push({
        hint: "new",
        id: `new:${query}`,
        insert: query,
        label: query,
      });
    }
    if (none && !query) {
      found.unshift({ id: NONE, insert: NONE, label: none });
    }
    return found;
  });

  function say(message: string) {
    status = message;
    clearTimeout(statusTimer);
    if (!busy) {
      statusTimer = setTimeout(() => (status = ""), STATUS_MS);
    }
  }

  function report(verb: string, outcome: Outcome) {
    const errors = outcome.errors.length
      ? `. Failed: ${outcome.errors.join("; ")}`
      : "";
    say(`${verb} ${outcome.done} of ${outcome.total}${errors}`);
  }

  export async function start(next: Mode, rows: Row[] = targets) {
    if (rows.length === 0 || busy) {
      return;
    }
    active = rows;
    mode = next;
    text = "";
    status = "";
    await tick();
    input?.focus();
  }

  function cancel() {
    mode = null;
    text = "";
  }

  function idOf(current: Mode, value: string | null): string | null {
    const items = current === "bill" ? bills.data : budgets.data;
    return items?.find((item) => item.attributes.name === value)?.id ?? null;
  }

  async function run(action: MassAction, rows: Row[]) {
    const verb = VERB[action.mode];
    busy = true;
    const outcome = await updateGroups(
      targetsOf(rows),
      patchFor(action),
      (progress) =>
        say(`${verb}: updated ${progress.done} of ${progress.total}`)
    );
    await invalidate();
    busy = false;
    report("Updated", outcome);
  }

  async function apply(raw: string) {
    if (!mode) {
      return;
    }
    const value = raw === NONE ? null : raw.trim() || null;
    if (value === null && (mode === "tag" || mode === "untag")) {
      return;
    }
    const byId = mode === "budget" || mode === "bill";
    const id = byId ? idOf(mode, value) : null;
    if (byId && value !== null && id === null) {
      say(`Nothing called “${value}”`);
      return;
    }
    const action = { id, mode, value };
    lastAction.current = action;
    mode = null;
    await run(action, active);
  }

  export async function repeat(rows: Row[] = targets) {
    const action = lastAction.current;
    if (!action || busy || rows.length === 0) {
      return;
    }
    active = rows;
    await run(action, rows);
  }

  export async function remove(rows: Row[] = targets, confirmed = false) {
    if (busy || rows.length === 0) {
      return;
    }
    if (confirmed) {
      active = rows;
    } else if (!armed) {
      active = rows;
      armed = true;
      clearTimeout(armTimer);
      armTimer = setTimeout(() => (armed = false), ARM_MS);
      return;
    }
    clearTimeout(armTimer);
    armed = false;
    busy = true;
    const outcome = await deleteTargets(targetsOf(active), (progress) =>
      say(`Deleted ${progress.done} of ${progress.total}`)
    );
    onclear();
    await invalidate();
    busy = false;
    report("Deleted", outcome);
  }
</script>

{#if visible}
  <div
    aria-label="Selection actions"
    class="m-2 flex min-h-10 flex-wrap items-center gap-2 rounded-cladd-md bg-row-selected/50 px-2.5 py-1.5 text-[12px]"
    role="toolbar"
  >
    <span class="font-semibold text-cladd-fg">
      {count}
      {count === 1 ? "transaction" : "transactions"}
      {selected > 0 && !mode ? "selected" : ""}
    </span>
    {#if mode}
      <label class="text-cladd-fg-soft" for="action-bar-input"
        >{VERB[mode]}:</label
      >
      <SuggestInput
        class="w-72"
        id="action-bar-input"
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
        apply <span class="kbd">Esc</span> cancel</span
      >
    {:else}
      {#each MODES as item (item.mode)}
        <button
          class="cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-cladd-fg disabled:opacity-50"
          disabled={busy}
          onclick={() => start(item.mode)}
          type="button"
        >
          {item.label}
          <span class="kbd">{item.keys}</span>
        </button>
      {/each}
      <button
        aria-live="polite"
        class="cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold disabled:opacity-50 {armed
          ? "cladd-color-red text-cladd-primary"
          : "text-cladd-fg"}"
        disabled={busy}
        onclick={() => remove()}
        type="button"
      >
        {#if armed}
          Press again to delete {count}
        {:else}
          Delete <span class="kbd">d</span>
        {/if}
      </button>
      {#if selected > 0}
        <button
          class="inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2 text-cladd-fg-soft hover:text-cladd-fg"
          onclick={onclear}
          type="button"
        >
          Clear <span class="kbd">u</span>
        </button>
      {/if}
    {/if}
    <span aria-live="polite" class="ml-auto text-cladd-fg-soft">{status}</span>
  </div>
{/if}
