<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import DateInput from "#lib/components/inputs/DateInput.svelte";
  import { useKeys } from "#lib/keys.svelte.js";
  import { recall, remember } from "#lib/reports/memory.js";
  import { listOptions, listReady } from "#lib/reports/options.js";
  import {
    LIST_LABELS,
    REPORT_KINDS,
    type ReportParams,
    type ReportType,
    rangePresets,
    shiftRange,
  } from "#lib/reports/params.js";
  import {
    accountOptions,
    modeLabel,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import MultiSelect from "./MultiSelect.svelte";

  const report = useReport();

  let accountsOpen = $state(false);
  let itemsOpen = $state(false);
  let typeSelect = $state<HTMLSelectElement>();
  let startInput = $state<HTMLInputElement | null>(null);

  const p = $derived(report.params);
  const presets = rangePresets();
  const preset = $derived(
    presets.find((x) => x.range.start === p.start && x.range.end === p.end)
      ?.key ?? "custom"
  );
  const options = $derived(accountOptions(report.accounts()));
  const list = $derived(report.kind?.list);
  const sources = $derived({
    budgets: report.budgets,
    categories: report.categories,
    expense: report.expense,
    revenue: report.revenue,
    tags: report.tags,
  });
  const itemOptions = $derived(list ? listOptions(list, sources) : []);
  const accountValue = $derived(report.selected);

  function go(changes: Partial<ReportParams>) {
    const next = { ...p, ...changes };
    remember(next);
    navigate({}, report.path(changes));
  }

  function defaultItems(type: ReportType): string[] {
    const kind = REPORT_KINDS.find((k) => k.type === type)?.list;
    if (!kind) {
      return [];
    }
    const stored = recall().items[kind];
    if (stored && stored.length > 0) {
      return stored;
    }
    if (kind === "double") {
      const top = new Map<string, number>();
      for (const flow of report.flows ?? []) {
        if (flow.type === "withdrawal") {
          top.set(flow.other.id, (top.get(flow.other.id) ?? 0) + 1);
        }
      }
      const ids = [...top.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
      return ids.length > 0 ? ids : ["0"];
    }
    return [
      { budget: "allBudgets", category: "allCategories", tag: "allTags" }[kind],
    ];
  }

  function setType(type: ReportType) {
    go({ items: defaultItems(type), type });
  }

  function setRange(a: string, b: string) {
    const [start, end] = a <= b ? [a, b] : [b, a];
    if (start && end && (start !== p.start || end !== p.end)) {
      go({ end, start });
    }
  }

  function shift(dir: 1 | -1) {
    const range = shiftRange(p, dir);
    go({ end: range.end, start: range.start });
  }

  function cycleMode() {
    const { available } = report;
    if (available.length > 1) {
      const next =
        available[(available.indexOf(report.mode) + 1) % available.length];
      navigate({ cur: next });
    }
  }

  useKeys(() => [
    {
      group: "Report",
      keys: "[",
      label: "Shift report back one period",
      run: () => shift(-1),
    },
    {
      group: "Report",
      keys: "]",
      label: "Shift report forward one period",
      run: () => shift(1),
    },
    {
      group: "Report",
      keys: "t",
      label: "Change report type",
      run: () => typeSelect?.focus(),
    },
    {
      group: "Report",
      keys: "a",
      label: "Choose accounts",
      run: () => (accountsOpen = true),
    },
    ...(list
      ? [
          {
            group: "Report",
            keys: "f",
            label: `Choose ${LIST_LABELS[list].many.toLowerCase()}`,
            run: () => (itemsOpen = true),
          },
        ]
      : []),
    {
      group: "Report",
      keys: "d",
      label: "Change dates",
      run: () => startInput?.focus(),
    },
    ...(report.available.length > 1
      ? [
          {
            group: "Report",
            keys: "c",
            label: "Next currency in charts",
            run: cycleMode,
          },
        ]
      : []),
  ]);
</script>

<div
  class="cladd-surface cladd-outline z-20 mb-4 lg:sticky lg:top-14 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-cladd-lg px-3 py-2"
>
  <div
    class="flex min-w-0 flex-1 flex-wrap items-end gap-x-3 gap-y-2 max-sm:basis-full"
  >
    <label class="flex flex-col gap-0.5 max-sm:w-full">
      <span class="text-[11px] text-cladd-fg-soft">Report type</span>
      <select
        class="cladd-cut cladd-focusable-input h-8 max-w-[14rem] rounded-cladd-sm px-2 text-[13px] text-cladd-fg max-sm:max-w-none"
        onchange={(event) => setType(event.currentTarget.value as ReportType)}
        value={p.type}
        bind:this={typeSelect}
      >
        {#each REPORT_KINDS as kind (kind.type)}
          <option value={kind.type}>{kind.label}</option>
        {/each}
      </select>
    </label>
    <div class="flex min-w-0 flex-col gap-0.5 max-sm:w-full">
      <label class="text-[11px] text-cladd-fg-soft" for="report-accounts"
        >Accounts</label
      >
      <MultiSelect
        class="w-44 max-sm:w-full"
        id="report-accounts"
        label="Accounts"
        loading={!report.accountsReady}
        onchange={(accounts) => go({ accounts })}
        {options}
        value={accountValue}
        bind:open={accountsOpen}
      />
    </div>
    {#if list}
      <div class="flex min-w-0 flex-col gap-0.5 max-sm:w-full">
        <label class="text-[11px] text-cladd-fg-soft" for="report-items"
          >{LIST_LABELS[list].many}</label
        >
        <MultiSelect
          class="w-48 max-sm:w-full"
          id="report-items"
          label={LIST_LABELS[list].many}
          loading={!listReady(list, sources)}
          onchange={(items) => go({ items })}
          options={itemOptions}
          value={report.items}
          bind:open={itemsOpen}
        />
      </div>
    {/if}
    <div class="flex flex-col gap-0.5 max-sm:w-full">
      <span class="text-[11px] text-cladd-fg-soft">Date range</span>
      <div class="flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-2">
        <button
          aria-label="Previous period"
          class="grid size-8 place-items-center rounded-cladd-sm text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg max-sm:order-2"
          onclick={() => shift(-1)}
          title="Previous period  ["
          type="button"
        >
          <ChevronLeft class="size-4" />
        </button>
        <div
          class="flex items-center gap-2 max-sm:w-full max-sm:flex-col max-sm:items-stretch"
        >
          <DateInput
            aria-label="Start date"
            class="w-[8.75rem] max-sm:w-full [&>input]:h-8"
            compact
            oncommit={(value) => setRange(value, p.end)}
            value={p.start}
            bind:ref={startInput}
          />
          <span class="text-cladd-fg-soft max-sm:hidden">to</span>
          <DateInput
            aria-label="End date"
            class="w-[8.75rem] max-sm:w-full [&>input]:h-8"
            compact
            oncommit={(value) => setRange(p.start, value)}
            value={p.end}
          />
        </div>
        <button
          aria-label="Next period"
          class="grid size-8 place-items-center rounded-cladd-sm text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg max-sm:order-4"
          onclick={() => shift(1)}
          title="Next period  ]"
          type="button"
        >
          <ChevronRight class="size-4" />
        </button>
        <select
          aria-label="Preset range"
          class="cladd-cut cladd-focusable-input h-8 rounded-cladd-sm px-2 text-[13px] text-cladd-fg max-sm:order-3 max-sm:flex-1"
          onchange={(event) => {
            const found = presets.find(
              (x) => x.key === event.currentTarget.value
            );
            if (found) {
              setRange(found.range.start, found.range.end);
            }
          }}
          value={preset}
        >
          {#each presets as item (item.key)}
            <option value={item.key}>{item.label}</option>
          {/each}
          <option disabled value="custom">Custom</option>
        </select>
      </div>
    </div>
  </div>
  {#if report.available.length > 1}
    <fieldset class="shrink-0">
      <legend class="float-left mb-0.5 w-full text-[11px] text-cladd-fg-soft">
        Charts in
      </legend>
      <div
        class="cladd-cut clear-both flex h-8 items-center gap-0.5 rounded-cladd-sm p-0.5"
      >
        {#each report.available as mode (mode)}
          <button
            aria-pressed={report.mode === mode}
            class="num h-7 rounded-[5px] px-2 text-[12px] {report.mode === mode
              ? "cladd-surface cladd-outline font-semibold text-cladd-fg"
              : "text-cladd-fg-soft hover:text-cladd-fg"}"
            onclick={() => navigate({ cur: mode })}
            title="Show charts in {modeLabel(mode)}  c"
            type="button"
          >
            {modeLabel(mode)}
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}
</div>
