<script lang="ts">
  import { setMode } from "mode-watcher";
  import { invalidate } from "#lib/api/lists.js";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import Input from "#lib/components/ui/input/input.svelte";
  import type { ViewRange } from "#lib/dates.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import Section from "./Section.svelte";

  type Dark = "light" | "dark" | "browser";

  const VIEW_RANGES: [ViewRange, string][] = [
    ["1D", "One day"],
    ["1W", "One week"],
    ["last7", "Last 7 days"],
    ["1M", "One month"],
    ["last30", "Last 30 days"],
    ["MTD", "Month to date"],
    ["3M", "Three months (quarter)"],
    ["last90", "Last 90 days"],
    ["QTD", "Quarter to date"],
    ["6M", "Six months"],
    ["1Y", "One year"],
    ["YTD", "Year to date"],
    ["last365", "Last year"],
  ];
  const DARK: [Dark, string][] = [
    ["light", "Always light"],
    ["dark", "Always dark"],
    ["browser", "Let your browser decide"],
  ];
  const MAX_PAGE_SIZE = 1336;

  let view = $state<ViewRange>(session.viewRange);
  let size = $state(session.pageSize);
  let dark = $state<Dark>((session.prefs.darkMode as Dark) ?? "browser");

  const viewAction = new Action();
  const sizeAction = new Action();
  const darkAction = new Action();

  const saveView = () =>
    viewAction.run(async () => {
      await session.setPreference("viewRange", view);
      period.view = view;
      period.reset();
    });

  const saveSize = () =>
    sizeAction.run(async () => {
      const value = Math.round(Number(size));
      if (!(value >= 1 && value <= MAX_PAGE_SIZE)) {
        throw new Error(`Pick a number from 1 to ${MAX_PAGE_SIZE}`);
      }
      await session.setPreference("listPageSize", value);
      await invalidate();
    });

  const saveDark = () =>
    darkAction.run(async () => {
      await session.setPreference("darkMode", dark);
      setMode(dark === "browser" ? "system" : dark);
    });
</script>

<div class="grid items-start gap-4 lg:grid-cols-2">
  <Section
    action={viewAction}
    help="Some charts are automatically grouped in periods. Your budgets will also be grouped in periods. What period would you prefer?"
    onsave={saveView}
    title="View range"
  >
    <div class="grid gap-1.5 sm:grid-flow-col sm:grid-rows-7">
      {#each VIEW_RANGES as [value, label] (value)}
        <label class="flex items-center gap-2">
          <input
            class="size-3.5 accent-brand"
            name="viewRange"
            type="radio"
            {value}
            bind:group={view}
          >
          {label}
        </label>
      {/each}
    </div>
  </Section>

  <div class="flex flex-col gap-4">
    <Section
      action={sizeAction}
      help="Any list of things (accounts, transactions, etc) shows at most this many per page."
      onsave={saveSize}
      title="Page size"
    >
      <span class="flex items-center gap-2">
        <label for="page-size">Page size</label>
        <Input
          class="num w-28"
          id="page-size"
          max={MAX_PAGE_SIZE}
          min={1}
          type="number"
          bind:value={size}
        />
      </span>
    </Section>

    <Section
      action={darkAction}
      help="Tell Firefly III when to use dark mode. This interface follows the same setting."
      onsave={saveDark}
      title="Dark mode"
    >
      <div class="flex flex-col gap-1.5">
        {#each DARK as [value, label] (value)}
          <label class="flex items-center gap-2">
            <input
              class="size-3.5 accent-brand"
              name="darkMode"
              type="radio"
              {value}
              bind:group={dark}
            >
            {label}
          </label>
        {/each}
      </div>
    </Section>
  </div>
</div>
