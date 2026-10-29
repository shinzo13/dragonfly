<script lang="ts">
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, Tag } from "#lib/api/types.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import type { Outcome } from "#lib/transactions/mass.js";
  import { mergeTag } from "./actions.js";

  const SUGGESTIONS = 6;

  let {
    tag,
    tags,
    ondone,
  }: { tag: Item<Tag>; tags: Item<Tag>[]; ondone: () => void } = $props();

  let value = $state("");
  let cursor = $state(0);
  let busy = $state(false);
  let outcome = $state<Outcome | null>(null);
  let problem = $state("");

  const options = $derived(
    fuzzyFilter(
      tags.filter((t) => t.id !== tag.id),
      value,
      (t) => t.attributes.tag,
      SUGGESTIONS
    )
  );

  function focus(input: HTMLInputElement) {
    input.focus();
  }

  async function run(into: string) {
    const target = into.trim();
    if (!target || busy) {
      return;
    }
    busy = true;
    problem = "";
    try {
      const result = await mergeTag(tag, target, (next) => (outcome = next));
      await invalidate();
      if (result.errors.length > 0) {
        problem = `${result.errors.length} failed: ${result.errors[0]}`;
        return;
      }
      ondone();
    } catch (failure) {
      problem = failure instanceof Error ? failure.message : String(failure);
    } finally {
      busy = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      cursor = Math.min(options.length - 1, cursor + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      cursor = Math.max(0, cursor - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(options[cursor]?.attributes.tag ?? value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      ondone();
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2 py-0.5">
  <span class="text-[12px] text-cladd-fg-soft">Merge into</span>
  <input
    aria-label="Merge {tag.attributes.tag} into"
    class="cladd-cut cladd-focusable-input h-6 w-60 rounded-cladd-sm px-1.5 text-[13px]"
    oninput={() => (cursor = 0)}
    {onkeydown}
    placeholder="tag name"
    readonly={busy}
    bind:value
    {@attach focus}
  >
  {#if !busy && options.length > 0}
    <span
      aria-label="Suggestions"
      class="flex flex-wrap items-baseline gap-x-2.5 text-[12px]"
      role="listbox"
    >
      {#each options as option, i (option.id)}
        <span
          aria-selected={i === cursor}
          class="cursor-pointer {i === cursor
            ? "font-semibold text-cladd-fg"
            : "text-cladd-fg-soft hover:text-cladd-fg"}"
          onmousedown={(event) => {
            event.preventDefault();
            run(option.attributes.tag);
          }}
          role="option"
          tabindex="-1"
        >
          {option.attributes.tag}
        </span>
      {/each}
    </span>
  {/if}
  <span class="text-[12px] text-cladd-fg-soft">
    {#if busy && outcome}
      Moving {outcome.done} of {outcome.total} transactions
    {:else if busy}
      Finding transactions
    {:else}
      <span class="kbd">↵</span>
      merge <span class="kbd">Esc</span> cancel
    {/if}
  </span>
  {#if problem}
    <span class="basis-full text-[12px] text-expense">{problem}</span>
  {/if}
</div>
