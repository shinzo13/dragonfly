<script lang="ts">
  import Box from "#lib/components/Box.svelte";
  import ReportPage from "#lib/components/reports/ReportPage.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { parseReport } from "#lib/reports/params.js";
  import { session } from "#lib/session.svelte.js";
  import { page } from "$app/state";

  const fiscal = $derived(
    session.prefs.customFiscalYear
      ? String(session.prefs.fiscalYearStart ?? "01-01")
      : "01-01"
  );
  const parsed = $derived(
    parseReport(page.params.type ?? "", page.params.rest ?? "", fiscal)
  );
</script>

{#if parsed.ok}
  <ReportPage params={parsed.params} />
{:else}
  <PageHeader
    crumbs={[{ href: "/reports", label: "Reports" }]}
    title="Reports"
  />
  <Box class="max-w-xl" title="This report cannot be shown">
    <p class="mb-2">{parsed.error}</p>
    <a
      class="text-brand dark:text-[var(--ff-series-1)] hover:underline"
      href="/reports"
      >Back to reports</a
    >
  </Box>
{/if}
