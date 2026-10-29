<script lang="ts" module>
  export interface Option {
    data?: unknown;
    hint?: string;
    id: string;
    label: string;
    meta?: string;
  }
</script>

<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { INPUT, LIST } from "./styles.js";

  const DEBOUNCE_MS = 150;
  const STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
  const CTRL_STEPS: Record<string, number> = { n: 1, p: -1 };

  let {
    value = $bindable(""),
    selected = $bindable(null),
    ref = $bindable(null),
    search,
    onpick,
    free = false,
    async = false,
    openOnFocus = false,
    invalid = false,
    bare = false,
    class: className = "",
    inputClass = "",
    onkeydown: onkey,
    onblur: onleave,
    onfocus: onenter,
    onenter: onsubmit,
    ...rest
  }: Omit<HTMLInputAttributes, "value" | "onkeydown" | "onblur" | "onfocus"> & {
    value?: string;
    selected?: Option | null;
    ref?: HTMLInputElement | null;
    search: (query: string) => Option[] | Promise<Option[]>;
    onpick?: (option: Option) => void;
    free?: boolean;
    async?: boolean;
    openOnFocus?: boolean;
    invalid?: boolean;
    bare?: boolean;
    inputClass?: string;
    onkeydown?: (event: KeyboardEvent) => void;
    onblur?: (event: FocusEvent) => void;
    onfocus?: (event: FocusEvent) => void;
    onenter?: (event: KeyboardEvent) => void;
  } = $props();

  const uid = $props.id();
  let open = $state(false);
  let items = $state<Option[]>([]);
  let active = $state(-1);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticket = 0;

  const query = $derived(value.trim());
  const exact = $derived(
    items.find((item) => item.label.toLowerCase() === query.toLowerCase())
  );
  const shown = $derived(
    free && query && !exact
      ? [...items, { hint: "new", id: "", label: query }]
      : items
  );

  async function load(text: string, highlight: boolean) {
    ticket += 1;
    const mine = ticket;
    const result = await search(text);
    if (mine !== ticket || document.activeElement !== ref) {
      return;
    }
    items = result;
    open = true;
    active = highlight && text.trim() ? 0 : -1;
  }

  function refresh(highlight: boolean) {
    clearTimeout(timer);
    if (async) {
      timer = setTimeout(() => load(value, highlight), DEBOUNCE_MS);
    } else {
      load(value, highlight);
    }
  }

  function close() {
    clearTimeout(timer);
    ticket += 1;
    open = false;
    active = -1;
  }

  function pick(option: Option) {
    value = option.label;
    selected = option.id ? option : null;
    close();
    onpick?.(option);
  }

  function move(step: number) {
    if (!open) {
      refresh(true);
      return;
    }
    const count = shown.length;
    if (count) {
      active =
        (active + step + count + (active < 0 && step < 0 ? 1 : 0)) % count;
    }
  }

  function stepOf(event: KeyboardEvent): number {
    const ctrl = event.ctrlKey && !event.metaKey && !event.altKey;
    return STEPS[event.key] ?? (ctrl ? CTRL_STEPS[event.key] : 0) ?? 0;
  }

  function handleKey(event: KeyboardEvent) {
    onkey?.(event);
    if (event.defaultPrevented) {
      return;
    }
    const step = stepOf(event);
    if (step) {
      event.preventDefault();
      move(step);
      return;
    }
    if (open && event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    const plain = !(
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    );
    const choice = open && plain ? shown[active] : undefined;
    if (choice && (event.key === "Enter" || event.key === "Tab")) {
      if (event.key === "Enter") {
        event.preventDefault();
      }
      pick(choice);
      return;
    }
    if (event.key === "Enter" && plain) {
      onsubmit?.(event);
    }
  }

  function handleInput({
    currentTarget,
  }: Event & { currentTarget: HTMLInputElement }) {
    ({ value } = currentTarget);
    if (selected && selected.label !== value) {
      selected = null;
    }
    refresh(true);
  }

  function handleBlur(event: FocusEvent) {
    if (!selected && exact) {
      value = exact.label;
      selected = exact;
      onpick?.(exact);
    }
    close();
    onleave?.(event);
  }

  function handleFocus(event: FocusEvent) {
    if (openOnFocus) {
      refresh(false);
    }
    onenter?.(event);
  }

  $effect(() => {
    if (open && active >= 0) {
      document
        .getElementById(`${uid}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  });
</script>

<div class="{bare ? "" : "relative"} {className}">
  <input
    bind:this={ref}
    {...rest}
    aria-activedescendant={open && active >= 0 ? `${uid}-${active}` : undefined}
    aria-autocomplete="list"
    aria-controls="{uid}-list"
    aria-expanded={open && shown.length > 0}
    aria-invalid={invalid || undefined}
    autocomplete="off"
    class={inputClass || (bare ? "" : INPUT)}
    onblur={handleBlur}
    onfocus={handleFocus}
    oninput={handleInput}
    onkeydown={handleKey}
    role="combobox"
    spellcheck="false"
    {value}
  >
  {#if open && shown.length > 0}
    <div class={LIST} id="{uid}-list" role="listbox">
      {#each shown as option, index (`${option.id}:${option.label}`)}
        <div
          aria-selected={index === active}
          class="flex cursor-pointer items-baseline gap-2 px-2.5 py-1.5 text-[13px] sm:py-1 {index ===
          active
            ? "bg-row-cursor"
            : "hover:bg-row-hover"}"
          id="{uid}-{index}"
          onmousedown={(event) => {
            event.preventDefault();
            pick(option);
          }}
          role="option"
          tabindex="-1"
        >
          <span class="min-w-0 flex-1 truncate">
            {#if option.hint === "new"}
              <span class="text-cladd-fg-soft">Create</span>
              "{option.label}"
            {:else}
              {option.label}
            {/if}
          </span>
          {#if option.hint && option.hint !== "new"}
            <span class="num shrink-0 text-[12px] text-cladd-fg-soft"
              >{option.hint}</span
            >
          {/if}
          {#if option.meta}
            <span class="shrink-0 text-[11px] text-cladd-fg-softer"
              >{option.meta}</span
            >
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
