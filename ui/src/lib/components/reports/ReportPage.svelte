<script lang="ts">
  import AllAccounts from "#lib/components/accounts/AllAccounts.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { formatRange } from "#lib/format.js";
  import type { ReportParams } from "#lib/reports/params.js";
  import { createReport, provideReport } from "#lib/reports/report.svelte.js";
  import DefaultReport from "./DefaultReport.svelte";
  import DimensionReport from "./DimensionReport.svelte";
  import ParamBar from "./ParamBar.svelte";

  let { params }: { params: ReportParams } = $props();

  const report = createReport(() => params);
  provideReport(report);

  const SUBTITLES: Record<string, string> = {
    audit: "All accounts",
    budget: "Budget report",
    category: "Category report",
    default: "Default financial report",
    double: "Expense/revenue account report",
    tag: "Tag report",
  };

  const subtitle = $derived(
    `${SUBTITLES[params.type]}, ${formatRange(params.start, params.end)}`
  );
</script>

<PageHeader
  crumbs={[
    { href: "/reports", label: "Reports" },
    { label: report.kind?.label ?? "" },
  ]}
  {subtitle}
  title="Reports"
/>
<ParamBar />
{#if report.error}
  <p class="mb-4 text-expense">
    Firefly III did not return the data for this report: {report.error.message}
  </p>
{/if}
{#if params.type === "default"}
  <DefaultReport />
{:else if params.type === "audit"}
  <AllAccounts
    accounts={report.selected}
    end={params.end}
    start={params.start}
  />
{:else}
  {#key params.type}
    <DimensionReport />
  {/key}
{/if}
