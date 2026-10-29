<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import Columns from "#lib/components/charts/Columns.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import { useKeys } from "#lib/keys.svelte.js";
  import { bucketOf, buckets, total } from "#lib/reports/flows.js";
  import {
    type Drill,
    drillFilter,
    drillQuery,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import {
    bucketLabel,
    bucketRows,
    FLOW_KEYS,
    modeAxis,
    modeFormat,
    upright,
  } from "#lib/reports/view.js";
  import Money from "./Money.svelte";

  let { drill }: { drill: Drill } = $props();

  const report = useReport();

  const subset = $derived(
    (report.scoped ?? [])
      .filter(drillFilter(drill, (date) => bucketOf(date, report.grain)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
  );
  const totals = $derived(total(subset));
  const groups = $derived.by(() => {
    const ids = new Set(subset.map((flow) => flow.group));
    return (report.groups ?? []).filter((group) => ids.has(group.id));
  });
  const showChart = $derived(
    !drill.at &&
      drill.dim !== "day" &&
      drill.dim !== "flow" &&
      report.grain !== "day" &&
      subset.length > 0
  );
  const rows = $derived(
    showChart
      ? upright(
          bucketRows(
            subset,
            buckets(report.params.start, report.params.end, report.grain),
            report.grain,
            report.mode
          )
        )
      : []
  );
  const keys = $derived(
    FLOW_KEYS.filter((key) =>
      rows.some((row) => (row.values[key.key] ?? 0) !== 0)
    )
  );
  const title = $derived(
    [drill.label, drill.at ? bucketLabel(drill.at, report.grain) : ""]
      .filter(Boolean)
      .join(", ")
  );

  function close() {
    navigate(drillQuery(null));
  }

  useKeys(() => [
    {
      group: "Report",
      keys: "Escape",
      label: "Close transactions list",
      run: close,
    },
  ]);
</script>

<section
  aria-label="Transactions for {title}"
  class="border-cladd-outline border-t bg-cladd-surface-next/50"
>
  <header class="flex flex-wrap items-start gap-x-4 gap-y-1 px-3 pt-2.5 pb-2">
    <div class="min-w-0 flex-1">
      <h3 class="truncate font-semibold text-[13px]">{title}</h3>
      <p class="text-[12px] text-cladd-fg-soft">
        {subset.length}
        {subset.length === 1 ? "transaction" : "transactions"}
      </p>
    </div>
    <div class="flex gap-4 text-right text-[12px]">
      {#each [
        { label: "In", side: "in" as const },
        { label: "Out", side: "out" as const },
      ] as column (column.side)}
        {#if [...totals.cur.values()].some((m) => m[column.side] > 0)}
          <div>
            <div class="text-cladd-fg-soft">{column.label}</div>
            <Money codes={report.codes} side={column.side} {totals} />
          </div>
        {/if}
      {/each}
    </div>
    <button
      aria-label="Close"
      class="grid size-7 place-items-center rounded-cladd-sm text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg"
      onclick={close}
      title="Close  Esc"
      type="button"
    >
      <X class="size-4" />
    </button>
  </header>
  {#if showChart && keys.length > 0}
    <div class="px-3 pb-2">
      <Columns
        axisFormat={modeAxis(report.mode)}
        format={modeFormat(report.mode)}
        height={180}
        {keys}
        label="{title} per period"
        onselect={(row) => navigate(drillQuery({ ...drill, at: row.key }))}
        {rows}
      />
    </div>
  {/if}
  {#if subset.length > 0}
    <TransactionTable {groups} id="drill" />
  {:else}
    <p class="px-3 pb-3 text-cladd-fg-soft">No transactions match.</p>
  {/if}
</section>
