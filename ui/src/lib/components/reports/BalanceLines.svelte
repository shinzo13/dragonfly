<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import type { LineSeries } from "#lib/components/charts/chart.js";
  import LineChart from "#lib/components/charts/LineChart.svelte";
  import { contains, today } from "#lib/dates.js";
  import { formatDate } from "#lib/format.js";
  import { displayCode, inDisplay, shownCode } from "#lib/reports/display.js";
  import { reportQueries } from "#lib/reports/queries.js";
  import { money, useReport } from "#lib/reports/report.svelte.js";
  import { modeAxis } from "#lib/reports/view.js";
  import ReportBox from "./ReportBox.svelte";

  let { net = false }: { net?: boolean } = $props();

  const report = useReport();
  const p = $derived(report.params);
  const ids = $derived(
    report.selected.filter(
      (id) => !net || report.byId().get(id)?.include_net_worth !== false
    )
  );
  const period = $derived.by(() => {
    if (!net) {
      return "1D";
    }
    return report.template === "multi-year" ? "1M" : "1W";
  });
  const chart = createQuery(() => ({
    ...reportQueries.chart(p.start, p.end, period, ids),
    enabled: report.accountsReady && ids.length > 0,
  }));

  const charts = $derived.by(() => {
    const byCode = new Map<string, LineSeries[]>();
    const sets = chart.data ?? [];
    const into = displayCode(
      new Set(sets.map((set) => set.currency_code ?? ""))
    );
    for (const set of sets) {
      const from = set.currency_code ?? "";
      const code = shownCode(from, into);
      const points = Object.entries(set.entries ?? {}).map(([x, y]) => ({
        x: x.slice(0, 10),
        y: inDisplay(Number(y), from, into).amount,
      }));
      const list = byCode.get(code) ?? [];
      if (net && list.length > 0) {
        const [sum] = list;
        sum.points = sum.points.map((point, i) => ({
          x: point.x,
          y: point.y + (points[i]?.y ?? 0),
        }));
      } else {
        list.push({
          format: (value: number) => money(code, value),
          key: net ? code : (set.label ?? code),
          label: net ? `Net worth in ${code}` : (set.label ?? code),
          points,
        });
      }
      byCode.set(code, list);
    }
    return [...byCode.entries()].sort(
      (a, b) => report.codes.indexOf(a[0]) - report.codes.indexOf(b[0])
    );
  });
  const marker = $derived(contains(p, today()) ? today() : undefined);
  const xFormat = $derived(
    report.template === "multi-year"
      ? (x: string) => formatDate(x, "month")
      : (x: string) => formatDate(x, "short")
  );
</script>

<ReportBox
  body="p-3"
  empty={charts.length === 0}
  emptyText="No accounts to chart."
  id={net ? "net-worth" : "balance-chart"}
  loading={chart.isPending && ids.length > 0}
  title={net ? "Net worth" : "Account balances"}
>
  <div class="grid gap-x-6 gap-y-4 {charts.length > 1 ? "xl:grid-cols-2" : ""}">
    {#each charts as [code, series] (code)}
      <div class="min-w-0">
        {#if charts.length > 1 || !net}
          <h3 class="mb-1 font-semibold text-[12px] text-cladd-fg-soft">
            {code}
          </h3>
        {/if}
        <LineChart
          axisFormat={modeAxis(code)}
          height={charts.length > 1 ? 200 : 240}
          label="{net ? "Net worth" : "Account balances"} in {code}"
          {marker}
          {series}
          {xFormat}
        />
      </div>
    {/each}
  </div>
</ReportBox>
