<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { isDynamic, type Range, shiftPeriod } from "#lib/dates.js";
  import { period, periodLabel } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { keptParams, periodPath } from "./period-path.svelte.js";

  const COUNT = 12;

  let { base }: { base: string } = $props();

  const view = $derived(isDynamic(period.view) ? "1M" : period.view);

  function walk(dir: 1 | -1): Range[] {
    const out: Range[] = [];
    let { range } = period;
    for (let i = 0; i < COUNT; i += 1) {
      range = shiftPeriod(range, view, dir);
      out.push(range);
    }
    return out;
  }

  const before = $derived(walk(-1));
  const after = $derived(walk(1));
  const kept = $derived(keptParams());
  const href = (range: Range) =>
    `${periodPath(base, range.start, range.end)}${kept}`;

  function pick(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    if (select.value) {
      goto(select.value);
    }
  }
</script>

<nav
  aria-label="Period"
  class="grid items-center gap-3 pb-3 sm:grid-cols-[1fr_auto_1fr]"
>
  <select
    aria-label="Earlier periods"
    class="cladd-cut h-7 max-w-44 rounded-cladd-sm px-2 text-[12px] text-cladd-fg-soft max-sm:hidden"
    onchange={pick}
  >
    <option value="">Select date..</option>
    {#each before as range (range.start)}
      <option value={href(range)}>{periodLabel(range, view)}</option>
    {/each}
  </select>
  <div class="flex items-center gap-1 justify-self-center">
    <a
      aria-label="Previous period"
      class="grid size-7 place-items-center rounded-cladd-sm text-cladd-fg-soft hover:bg-cladd-surface-next hover:text-cladd-fg"
      href={href(before[0])}
      title="Previous period  ["
    >
      <ChevronLeft class="size-4" />
    </a>
    <span class="min-w-40 text-center font-semibold text-[14px] text-cladd-fg"
      >{period.label}</span
    >
    <a
      aria-label="Next period"
      class="grid size-7 place-items-center rounded-cladd-sm text-cladd-fg-soft hover:bg-cladd-surface-next hover:text-cladd-fg"
      href={href(after[0])}
      title="Next period  ]"
    >
      <ChevronRight class="size-4" />
    </a>
  </div>
  <select
    aria-label="Later periods"
    class="cladd-cut h-7 max-w-44 justify-self-end rounded-cladd-sm px-2 text-[12px] text-cladd-fg-soft max-sm:hidden"
    onchange={pick}
  >
    <option value="">Select date..</option>
    {#each after as range (range.start)}
      <option value={href(range)}>{periodLabel(range, view)}</option>
    {/each}
  </select>
</nav>
