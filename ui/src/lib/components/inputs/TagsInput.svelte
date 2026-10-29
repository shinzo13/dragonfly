<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import AutocompleteInput, { type Option } from "./AutocompleteInput.svelte";
  import { WELL } from "./styles.js";

  let {
    tags = $bindable([]),
    ref = $bindable(null),
    search,
    id,
    placeholder = "",
    invalid = false,
  }: {
    tags?: string[];
    ref?: HTMLInputElement | null;
    search: (query: string, taken: string[]) => Option[];
    id?: string;
    placeholder?: string;
    invalid?: boolean;
  } = $props();

  let text = $state("");

  function add(raw: string) {
    const names = raw
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const known = new Set(tags.map((tag) => tag.toLowerCase()));
    const fresh = names.filter((name) => !known.has(name.toLowerCase()));
    if (fresh.length) {
      tags = [...tags, ...fresh];
    }
    text = "";
  }

  function remove(index: number) {
    tags = tags.filter((_, i) => i !== index);
    ref?.focus();
  }

  function handleKey(event: KeyboardEvent) {
    const plain = !(event.ctrlKey || event.metaKey || event.altKey);
    if (event.key === "," && plain) {
      event.preventDefault();
      add(text);
      return;
    }
    if (event.key === "Backspace" && text === "" && tags.length && plain) {
      event.preventDefault();
      tags = tags.slice(0, -1);
    }
  }

  function handleEnter(event: KeyboardEvent) {
    if (text.trim()) {
      event.preventDefault();
      add(text);
    }
  }
</script>

<div
  class="{WELL} relative flex min-h-9 w-full flex-wrap items-center gap-1 px-1.5 py-1 sm:min-h-cladd-md sm:py-0.5"
>
  {#each tags as tag, index (tag)}
    <span
      class="inline-flex h-6 items-center gap-1 rounded-[5px] bg-cladd-surface-next pr-0.5 pl-1.5 text-[12px] text-cladd-fg sm:h-5"
    >
      {tag}
      <button
        aria-label="Remove tag {tag}"
        class="grid size-4 place-items-center rounded text-cladd-fg-soft hover:bg-black/10 hover:text-cladd-fg"
        onclick={() => remove(index)}
        tabindex="-1"
        type="button"
      >
        <X class="size-3" />
      </button>
    </span>
  {/each}
  <AutocompleteInput
    bare
    class="min-w-24 flex-1"
    free
    {id}
    inputClass="h-7 w-full min-w-0 bg-transparent px-1 text-[16px] outline-none placeholder:text-cladd-fg-softer sm:h-6 sm:text-[13px]"
    {invalid}
    onblur={() => add(text)}
    onenter={handleEnter}
    onkeydown={handleKey}
    onpick={(option) => add(option.label)}
    placeholder={tags.length ? "" : placeholder}
    search={(query) => search(query, tags)}
    bind:ref
    bind:value={text}
  />
</div>
