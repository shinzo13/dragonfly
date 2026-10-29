<script lang="ts">
  import Calendar from "@lucide/svelte/icons/calendar";
  import { tick, untrack } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";
  import { addDays, today } from "#lib/dates.js";
  import { formatDate } from "#lib/format.js";
  import { parseDate } from "./parse.js";
  import { INPUT } from "./styles.js";

  let {
    value = $bindable(""),
    ref = $bindable(null),
    invalid = false,
    compact = false,
    oncommit,
    class: className = "",
    ...rest
  }: Omit<HTMLInputAttributes, "value"> & {
    value?: string;
    ref?: HTMLInputElement | null;
    invalid?: boolean;
    compact?: boolean;
    oncommit?: (value: string) => void;
  } = $props();

  let text = $state(value);
  let picker = $state<HTMLInputElement | null>(null);
  let focused = $state(false);

  const parsed = $derived(parseDate(text, today()));
  const shown = $derived(parsed ?? value);
  const label = $derived(
    shown
      ? `${formatDate(shown, "day")}${shown.slice(0, 4) === today().slice(0, 4) ? "" : ` ${shown.slice(0, 4)}`}`
      : ""
  );
  const display = $derived(
    compact && !focused && shown ? formatDate(shown) : text
  );

  $effect(() => {
    const next = value;
    untrack(() => {
      if (next && next !== parseDate(text)) {
        text = next;
      }
    });
  });

  function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
    text = event.currentTarget.value;
    const next = parseDate(text);
    if (next) {
      value = next;
    }
  }

  function commit(next: string) {
    text = next;
    value = next;
    oncommit?.(next);
  }

  function handleFocus(
    event: FocusEvent & { currentTarget: HTMLInputElement }
  ) {
    focused = true;
    const input = event.currentTarget;
    if (compact) {
      tick().then(() => input.select());
    }
  }

  function handleBlur() {
    focused = false;
    if (parsed) {
      commit(parsed);
    }
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Enter" && parsed) {
      commit(parsed);
    }
    if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      !(event.altKey || event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      const step =
        (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 7 : 1);
      commit(addDays(parsed ?? value ?? today(), step));
    }
  }

  function openPicker() {
    picker?.showPicker?.();
  }
</script>

<div class="relative {className}">
  <input
    bind:this={ref}
    {...rest}
    aria-invalid={invalid || (text.trim() !== "" && !parsed) || undefined}
    autocomplete="off"
    class="{INPUT} num {compact ? "pr-8" : "pr-28"}"
    onblur={handleBlur}
    onfocus={handleFocus}
    oninput={handleInput}
    onkeydown={handleKey}
    spellcheck="false"
    value={display}
  >
  {#if !compact}
    <span
      class="pointer-events-none absolute inset-y-0 right-9 flex items-center text-[12px] text-cladd-fg-soft"
      >{label}</span
    >
  {/if}
  <button
    aria-label="Pick a date"
    class="absolute inset-y-0 right-0 grid w-8 place-items-center text-cladd-fg-soft hover:text-cladd-fg"
    onclick={openPicker}
    tabindex="-1"
    type="button"
  >
    <Calendar class="size-3.5" />
  </button>
  <input
    aria-hidden="true"
    class="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
    onchange={({ currentTarget }) => commit(currentTarget.value)}
    tabindex="-1"
    type="date"
    {value}
    bind:this={picker}
  >
</div>
