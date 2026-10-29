<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { Popover } from "bits-ui";
  import type { Option } from "#lib/reports/report.svelte.js";

  let {
    options,
    value,
    onchange,
    label,
    id,
    open = $bindable(false),
    loading = false,
    class: className = "",
  }: {
    options: Option[];
    value: string[];
    onchange: (next: string[]) => void;
    label: string;
    id: string;
    open?: boolean;
    loading?: boolean;
    class?: string;
  } = $props();

  let query = $state("");
  let active = $state(0);

  const chosen = $derived(new Set(value));
  const visible = $derived(
    query
      ? options.filter((o) =>
          `${o.label} ${o.group ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
      : options
  );
  const groups = $derived.by(() => {
    const map = new Map<string, Option[]>();
    for (const option of visible) {
      const key = option.group ?? "";
      map.set(key, [...(map.get(key) ?? []), option]);
    }
    return [...map.entries()];
  });
  const summary = $derived.by(() => {
    const picked = options.filter((o) => chosen.has(o.id));
    if (picked.length === 0) {
      return loading ? "Loading" : "None selected";
    }
    if (picked.length === options.length && options.length > 2) {
      return `All selected (${options.length})`;
    }
    if (picked.length <= 2) {
      return picked.map((o) => o.label).join(", ");
    }
    return `${picked.length} selected: ${picked.map((o) => o.label).join(", ")}`;
  });

  function toggle(ids: string[], on: boolean) {
    const next = new Set(chosen);
    for (const optionId of ids) {
      if (on) {
        next.add(optionId);
      } else {
        next.delete(optionId);
      }
    }
    onchange(options.filter((o) => next.has(o.id)).map((o) => o.id));
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = Math.max(0, Math.min(visible.length - 1, active + step));
      document
        .getElementById(`${id}-opt-${active}`)
        ?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && !(event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      const option = visible[active];
      if (option) {
        toggle([option.id], !chosen.has(option.id));
      }
    }
  }
</script>

<Popover.Root
  onOpenChange={(next) => {
    if (!next) {
      query = "";
      active = 0;
    }
  }}
  bind:open
>
  <Popover.Trigger
    aria-label="{label}: {summary}"
    class="cladd-cut cladd-focusable-input flex h-8 min-w-0 items-center gap-2 rounded-cladd-sm px-2.5 text-left text-[13px] text-cladd-fg {className}"
    {id}
  >
    <span class="min-w-0 flex-1 truncate">{summary}</span>
    <ChevronDown class="size-3.5 shrink-0 text-cladd-fg-soft" />
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      align="start"
      class="cladd-surface cladd-gradient cladd-outline cladd-level-1 cladd-anim-popover z-50 flex max-h-[min(70vh,32rem)] w-80 flex-col rounded-cladd-lg text-cladd-fg shadow-cladd-popover outline-none"
      sideOffset={6}
    >
      <div class="flex flex-col gap-2 border-cladd-outline border-b p-2">
        <input
          aria-label="Find {label.toLowerCase()}"
          class="cladd-cut cladd-focusable-input h-8 rounded-cladd-sm px-2 text-[13px]"
          {onkeydown}
          placeholder="Find.."
          bind:value={query}
        >
        <div class="flex items-center gap-3 text-[12px]">
          <button
            class="text-brand dark:text-[var(--ff-series-1)] hover:underline"
            onclick={() =>
              toggle(
                visible.map((o) => o.id),
                true
              )}
            type="button"
          >
            Select all
          </button>
          <button
            class="text-brand dark:text-[var(--ff-series-1)] hover:underline"
            onclick={() =>
              toggle(
                visible.map((o) => o.id),
                false
              )}
            type="button"
          >
            None
          </button>
          <span class="num ml-auto text-cladd-fg-soft"
            >{chosen.size}
            of {options.length}</span
          >
        </div>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-1">
        {#each groups as [group, items] (group)}
          {#if group}
            {@const all = items.every((o) => chosen.has(o.id))}
            <button
              class="flex h-7 w-full items-center px-2 text-left font-semibold text-[11px] text-cladd-fg-soft uppercase tracking-wide hover:text-cladd-fg"
              onclick={() =>
                toggle(
                  items.map((o) => o.id),
                  !all
                )}
              title={all ? `Deselect ${group}` : `Select ${group}`}
              type="button"
            >
              {group}
            </button>
          {/if}
          {#each items as option (option.id)}
            {@const index = visible.indexOf(option)}
            <label
              class="flex h-7 cursor-pointer items-center gap-2 rounded-cladd-sm px-2 text-[13px] hover:bg-row-hover {index ===
              active
                ? "bg-row-cursor"
                : ""}"
              id="{id}-opt-{index}"
            >
              <input
                checked={chosen.has(option.id)}
                class="size-3.5 accent-[var(--ff-brand)]"
                onchange={(event) =>
                  toggle([option.id], event.currentTarget.checked)}
                type="checkbox"
              >
              <span class="min-w-0 flex-1 truncate">{option.label}</span>
              {#if option.note}
                <span class="shrink-0 text-[11px] text-cladd-fg-soft"
                  >{option.note}</span
                >
              {/if}
            </label>
          {/each}
        {:else}
          <p class="px-2 py-1.5 text-cladd-fg-soft">
            {#if query}
              Nothing matches
            {:else}
              {loading ? "Loading" : "Nothing to choose from"}
            {/if}
          </p>
        {/each}
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
