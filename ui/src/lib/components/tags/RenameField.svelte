<script lang="ts">
  import { untrack } from "svelte";
  import { ApiError } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, Tag } from "#lib/api/types.js";
  import { renameTag } from "./actions.js";
  import { descendants, type TagNode } from "./tree.js";

  let {
    node,
    tags,
    ondone,
  }: { node: TagNode; tags: Item<Tag>[]; ondone: () => void } = $props();

  let value = $state(untrack(() => node.path));
  let deep = $state(true);
  let busy = $state(false);
  let problem = $state("");

  const below = $derived(descendants(node).filter((child) => child.tag));

  function focus(input: HTMLInputElement) {
    input.focus();
    input.select();
  }

  async function save() {
    const next = value.trim();
    if (!next || next === node.path) {
      ondone();
      return;
    }
    const taken = tags.find(
      (t) =>
        t.id !== node.tag?.id &&
        t.attributes.tag.toLowerCase() === next.toLowerCase()
    );
    if (taken) {
      problem = `"${taken.attributes.tag}" already exists. To join them, use merge (m).`;
      return;
    }
    busy = true;
    problem = "";
    try {
      if (node.tag) {
        await renameTag(node.tag, next);
      }
      if (deep || !node.tag) {
        await Promise.all(
          below.map((child) =>
            child.tag
              ? renameTag(child.tag, next + child.path.slice(node.path.length))
              : null
          )
        );
      }
      await invalidate();
      ondone();
    } catch (failure) {
      const text =
        failure instanceof ApiError
          ? (Object.values(failure.errors).flat()[0] ?? failure.message)
          : String(failure);
      problem = `${text} To join it with an existing tag, use merge (m).`;
    } finally {
      busy = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      ondone();
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2 py-0.5">
  <input
    aria-label="New name for {node.path}"
    class="cladd-cut cladd-focusable-input h-6 w-72 rounded-cladd-sm px-1.5 text-[13px]"
    disabled={busy}
    {onkeydown}
    bind:value
    {@attach focus}
  >
  {#if node.tag && below.length > 0}
    <label class="flex items-center gap-1 text-[12px] text-cladd-fg-soft">
      <input class="accent-brand" type="checkbox" bind:checked={deep}>
      also rename {below.length} sub-tags
    </label>
  {:else if !node.tag}
    <span class="text-[12px] text-cladd-fg-soft"
      >renames {below.length} sub-tags</span
    >
  {/if}
  <span class="text-[12px] text-cladd-fg-soft">
    {#if busy}
      Renaming
    {:else}
      <span class="kbd">↵</span>
      save <span class="kbd">Esc</span> cancel
    {/if}
  </span>
  {#if problem}
    <span class="basis-full text-[12px] text-expense">{problem}</span>
  {/if}
</div>
