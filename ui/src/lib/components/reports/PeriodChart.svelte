<script lang="ts">
  import Columns from "#lib/components/charts/Columns.svelte";
  import { buckets, type Dimension, type Flow } from "#lib/reports/flows.js";
  import {
    drillQuery,
    modeLabel,
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
  import ReportBox from "./ReportBox.svelte";

  let {
    id = "period-chart",
    title = "Income vs. expenses",
    flows,
    dim,
    itemKey,
  }: {
    id?: string;
    title?: string;
    flows: Flow[] | undefined;
    dim?: Dimension;
    itemKey?: string;
  } = $props();

  const report = useReport();
  const keys = $derived(
    buckets(report.params.start, report.params.end, report.grain)
  );
  const rows = $derived(
    flows ? upright(bucketRows(flows, keys, report.grain, report.mode)) : []
  );
  const shownKeys = $derived(
    FLOW_KEYS.filter((key) =>
      rows.some((row) => (row.values[key.key] ?? 0) !== 0)
    )
  );
  const active = $derived(
    report.drill?.box === id ? (report.drill.at ?? null) : null
  );
</script>

<ReportBox
  body="p-3"
  empty={shownKeys.length === 0}
  {id}
  loading={!flows}
  title={title.endsWith(",")
    ? `${title} ${modeLabel(report.mode)}`
    : `${title} (${modeLabel(report.mode)})`}
>
  <Columns
    {active}
    axisFormat={modeAxis(report.mode)}
    format={modeFormat(report.mode)}
    height={260}
    keys={shownKeys}
    label="{title} per period"
    onselect={(row) =>
      navigate(
        drillQuery(
          active === row.key
            ? null
            : {
                at: row.key,
                box: id,
                dim: itemKey === undefined ? undefined : dim,
                key: itemKey,
                label: [
                  itemKey === undefined ? "" : title,
                  bucketLabel(row.key, report.grain),
                ]
                  .filter(Boolean)
                  .join(", "),
              }
        )
      )}
    {rows}
  />
</ReportBox>
