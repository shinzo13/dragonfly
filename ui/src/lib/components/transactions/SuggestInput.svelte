<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import type { Suggestion } from "#lib/transactions/query.js";

  let {
    value = $bindable(""),
    caret = $bindable(0),
    input = $bindable(),
    suggestions,
    onaccept,
    onsubmit,
    oncancel,
    onfocus,
    onblur,
    id,
    class: className = "",
    ...rest
  }: Omit<HTMLInputAttributes, "value" | "onsubmit"> & {
    value?: string;
    caret?: number;
    input?: HTMLInputElement;
    suggestions: Suggestion[];
    onaccept: (item: Suggestion) => boolean | undefined;
    onsubmit: () => void;
    oncancel?: () => void;
    id: string;
    class?: string;
  } = $props();

  let cursor = $state(0);
  let focused = $state(false);
  let dismissed = $state(false);

  const shown = $derived(focused && !dismissed && suggestions.length > 0);
  const listId = $derived(`${id}-suggestions`);

  $effect(() => {
    if (suggestions) {
      cursor = 0;
    }
  });

  function sync() {
    caret = input?.selectionStart ?? value.length;
  }

  function move(delta: number) {
    const count = suggestions.length;
    cursor = (cursor + delta + count) % count;
    document
      .getElementById(`${listId}-${cursor}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function accept(index: number): boolean {
    const item = suggestions[index];
    return item ? onaccept(item) !== false : false;
  }

  function onkeydown(event: KeyboardEvent) {
    const ctrl = event.ctrlKey || event.metaKey;
    const down = event.key === "ArrowDown" || (ctrl && event.key === "n");
    const up = event.key === "ArrowUp" || (ctrl && event.key === "p");
    if (shown && (down || up)) {
      event.preventDefault();
      move(down ? 1 : -1);
    } else if (shown && event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      accept(cursor);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!(shown && accept(cursor))) {
        onsubmit();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (shown) {
        dismissed = true;
      } else {
        oncancel?.();
        input?.blur();
      }
    }
  }
</script>

<div class="relative {className}">
  <input
    {...rest}
    aria-activedescendant={shown ? `${listId}-${cursor}` : undefined}
    aria-autocomplete="list"
    aria-controls={listId}
    aria-expanded={shown}
    autocomplete="off"
    class="cladd-cut cladd-focusable-input h-8 w-full rounded-cladd-md px-2.5 font-mono text-[13px] text-cladd-fg placeholder:font-sans placeholder:text-cladd-fg-softer"
    {id}
    onblur={(event) => {
      focused = false;
      onblur?.(event);
    }}
    onclick={sync}
    onfocus={(event) => {
      focused = true;
      sync();
      onfocus?.(event);
    }}
    oninput={() => {
      dismissed = false;
      sync();
    }}
    {onkeydown}
    onkeyup={sync}
    role="combobox"
    spellcheck="false"
    bind:this={input}
    bind:value
  >
  {#if shown}
    <div
      class="cladd-surface cladd-outline absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-cladd-md p-1 shadow-cladd-popover"
      id={listId}
      role="listbox"
    >
      {#each suggestions as item, index (item.id)}
        <div
          aria-selected={index === cursor}
          class="flex h-7 cursor-pointer items-center gap-3 rounded-cladd-sm px-2 text-[13px] {index ===
          cursor
            ? "bg-row-cursor"
            : "hover:bg-row-hover"}"
          id={`${listId}-${index}`}
          onmousedown={(event) => {
            event.preventDefault();
            accept(index);
          }}
          role="option"
          tabindex="-1"
        >
          <span class="min-w-0 flex-1 truncate font-mono">{item.label}</span>
          {#if item.hint}
            <span class="shrink-0 text-[11px] text-cladd-fg-softer"
              >{item.hint}</span
            >
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
