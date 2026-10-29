<script lang="ts">
  import CalendarRange from "@lucide/svelte/icons/calendar-range";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { Popover } from "bits-ui";
  import { period } from "#lib/period.svelte.js";
  import { ui } from "#lib/ui.svelte.js";

  let start = $state(period.start);
  let end = $state(period.end);

  $effect(() => {
    if (ui.periodOpen) {
      ({ start, end } = period);
    }
  });

  function apply(event: SubmitEvent) {
    event.preventDefault();
    if (start && end && start <= end) {
      period.set({ end, start });
      ui.periodOpen = false;
    }
  }
</script>

<div class="flex items-center rounded-cladd-md bg-black/10 text-on-brand">
  <button
    aria-label="Previous period"
    class="grid size-8 place-items-center rounded-l-cladd-md hover:bg-black/10"
    onclick={() => period.shift(-1)}
    title="Previous period  ["
    type="button"
  >
    <ChevronLeft class="size-4" />
  </button>
  <Popover.Root bind:open={ui.periodOpen}>
    <Popover.Trigger
      class="flex h-8 items-center gap-2 px-2 font-medium text-[13px] hover:bg-black/10"
      title="Choose period"
    >
      <CalendarRange class="size-3.5 opacity-80" />
      <span class="num">{period.label}</span>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        align="end"
        class="cladd-surface cladd-gradient cladd-outline cladd-level-1 cladd-anim-popover z-50 w-72 rounded-cladd-lg p-2 text-cladd-fg shadow-cladd-popover outline-none"
        sideOffset={6}
      >
        <div class="flex flex-col">
          {#each period.presets() as preset (preset.label)}
            {@const current =
              preset.range.start === period.start &&
              preset.range.end === period.end}
            <button
              class="flex h-8 items-center justify-between rounded-cladd-sm px-2.5 text-left text-[13px] hover:bg-cladd-surface-next {current
                ? "font-semibold"
                : ""}"
              onclick={() => {
                period.set(preset.range);
                ui.periodOpen = false;
              }}
              type="button"
            >
              {preset.label}
              {#if preset.key || preset.hint}
                <span class="kbd"
                  >{preset.key ? `p ${preset.key}` : preset.hint}</span
                >
              {/if}
            </button>
          {/each}
        </div>
        <form
          class="mt-2 flex flex-col gap-2 border-cladd-outline border-t px-1 pt-3"
          onsubmit={apply}
        >
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1 text-[11px] text-cladd-fg-soft">
              Start
              <input
                class="cladd-cut cladd-focusable-input h-8 rounded-cladd-sm px-2 text-[13px] text-cladd-fg"
                id="period-start"
                type="date"
                bind:value={start}
              >
            </label>
            <label class="flex flex-col gap-1 text-[11px] text-cladd-fg-soft">
              End
              <input
                class="cladd-cut cladd-focusable-input h-8 rounded-cladd-sm px-2 text-[13px] text-cladd-fg"
                type="date"
                bind:value={end}
              >
            </label>
          </div>
          <button
            class="cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-color-brand h-8 rounded-cladd-sm font-semibold text-[12px] text-cladd-primary"
            type="submit"
          >
            Apply custom range
          </button>
        </form>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
  <button
    aria-label="Next period"
    class="grid size-8 place-items-center rounded-r-cladd-md hover:bg-black/10"
    onclick={() => period.shift(1)}
    title="Next period  ]"
    type="button"
  >
    <ChevronRight class="size-4" />
  </button>
</div>
