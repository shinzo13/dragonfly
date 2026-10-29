<script lang="ts">
  import { untrack } from "svelte";
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, Split, Tag } from "#lib/api/types.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { convertTag, deleteTag } from "./actions.js";

  export interface Choice {
    id: string;
    name: string;
  }

  const SUGGESTIONS = 6;
  const NOUN = { bill: "subscription", category: "category" } as const;

  let {
    tag,
    kind,
    choices,
    initial,
    ondone,
  }: {
    tag: Item<Tag>;
    kind: "bill" | "category";
    choices: Choice[];
    initial: string;
    ondone: (status?: string) => void;
  } = $props();

  let value = $state(untrack(() => initial));
  let active = $state(-1);
  let busy = $state("");
  let fresh = $state("");
  let done = $state("");
  let problem = $state("");

  const lower = (text: string | null | undefined) =>
    (text ?? "").trim().toLowerCase();
  const exact = $derived(
    choices.find((choice) => lower(choice.name) === lower(value))
  );
  const options = $derived(
    done || busy || exact
      ? []
      : fuzzyFilter(choices, value, (choice) => choice.name, SUGGESTIONS)
  );

  function focus(input: HTMLInputElement) {
    input.focus();
    input.select();
  }

  function failed(failure: unknown) {
    problem = failure instanceof Error ? failure.message : String(failure);
  }

  function summary(name: string, splits: Split[]) {
    if (kind === "bill") {
      const others = splits.filter((s) => s.type !== "withdrawal").length;
      const linked = `${splits.length - others} linked to ${name}`;
      return others
        ? `${linked}, ${others} not withdrawals keep only the tag`
        : linked;
    }
    const before = [
      ...new Set(
        splits
          .map((s) => s.category_name ?? "")
          .filter((c) => c && lower(c) !== lower(name))
      ),
    ];
    const moved = `${splits.length} in ${name} now`;
    return before.length ? `${moved}, before: ${before.join(", ")}` : moved;
  }

  function patchFor(choice: Choice | undefined, name: string) {
    if (kind === "bill") {
      return (split: Split) =>
        split.type === "withdrawal" && split.bill_id !== choice?.id
          ? { bill_id: choice?.id }
          : null;
    }
    return (split: Split) =>
      lower(split.category_name) === lower(name)
        ? null
        : { category_name: name };
  }

  async function run(choice: Choice | undefined) {
    const name = choice?.name ?? value.trim();
    if (busy) {
      return;
    }
    if (!name) {
      problem = `Type a ${NOUN[kind]}`;
      return;
    }
    if (kind === "bill" && !choice) {
      problem = `No subscription called "${name}"`;
      return;
    }
    if (!choice && fresh !== name) {
      fresh = name;
      return;
    }
    busy = "Finding transactions";
    problem = "";
    try {
      const { outcome, splits } = await convertTag(
        tag,
        patchFor(choice, name),
        (o) => (busy = `Moving ${o.done} of ${o.total}`)
      );
      await invalidate();
      if (outcome.errors.length > 0) {
        problem = `${outcome.errors.length} failed: ${outcome.errors[0]}`;
        return;
      }
      done = summary(name, splits);
    } catch (failure) {
      failed(failure);
    } finally {
      busy = "";
    }
  }

  async function remove() {
    busy = "Deleting the tag";
    try {
      await deleteTag(tag);
      await invalidate();
      ondone();
    } catch (failure) {
      failed(failure);
      busy = "";
    }
  }

  function step(down: boolean) {
    const count = options.length;
    active =
      (Math.max(active, down ? -1 : 0) + (down ? 1 : -1) + count) % count;
  }

  function onkeydown(event: KeyboardEvent) {
    const arrow = event.key === "ArrowDown" || event.key === "ArrowUp";
    if (arrow && options.length > 0) {
      event.preventDefault();
      step(event.key === "ArrowDown");
    } else if (event.key === "Tab" && options.length > 0 && !event.shiftKey) {
      event.preventDefault();
      value = options[Math.max(active, 0)].name;
      active = -1;
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (done) {
        remove();
      } else {
        run(active >= 0 ? options[active] : exact);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      ondone(done || undefined);
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2 py-0.5">
  <span class="text-[12px] text-cladd-fg-soft">To {NOUN[kind]}</span>
  <input
    aria-label="Move {tag.attributes.tag} to a {NOUN[kind]}"
    class="cladd-cut cladd-focusable-input h-6 w-56 rounded-cladd-sm px-1.5 text-[13px]"
    oninput={() => {
      active = -1;
      fresh = "";
      problem = "";
    }}
    {onkeydown}
    readonly={Boolean(busy || done)}
    bind:value
    {@attach focus}
  >
  {#if options.length > 0}
    <span
      aria-label="Suggestions"
      class="flex flex-wrap items-baseline gap-x-2.5 text-[12px]"
      role="listbox"
    >
      <span class="kbd">Tab</span>
      {#each options as option, i (option.id)}
        <span
          aria-selected={i === Math.max(active, 0)}
          class="cursor-pointer {i === Math.max(active, 0)
            ? "font-semibold text-cladd-fg"
            : "text-cladd-fg-soft hover:text-cladd-fg"}"
          onmousedown={(event) => {
            event.preventDefault();
            run(option);
          }}
          role="option"
          tabindex="-1"
        >
          {option.name}
        </span>
      {/each}
    </span>
  {/if}
  <span class="text-[12px] text-cladd-fg-soft" role="status">
    {#if busy}
      {busy}
    {:else if done}
      <span class="text-cladd-fg">{done}.</span>
      <span class="kbd">↵</span>
      delete the tag <span class="kbd">Esc</span> keep it
    {:else if fresh}
      No {NOUN[kind]} called "{fresh}" yet. <span class="kbd">↵</span>
      again creates it
    {:else}
      <span class="kbd">↵</span>
      move its transactions <span class="kbd">Esc</span> cancel
    {/if}
  </span>
  {#if problem}
    <span class="basis-full text-[12px] text-expense">{problem}</span>
  {/if}
</div>
