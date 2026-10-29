<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import type { Account, Item, TransactionGroup } from "#lib/api/types.js";
  import type { Lane } from "#lib/components/charts/chart.js";
  import Lanes from "#lib/components/charts/Lanes.svelte";
  import { addDays, periodOf, today } from "#lib/dates.js";
  import { mergeLanes } from "#lib/money/lanes.js";
  import { longMonth, monthOf, shortMonth } from "#lib/reports/board.js";
  import { plainCode } from "#lib/reports/display.js";
  import { buckets } from "#lib/reports/flows.js";
  import { reportQueries } from "#lib/reports/queries.js";
  import { impliedRates } from "#lib/reports/rates.js";
  import { money, useReport } from "#lib/reports/report.svelte.js";
  import { modeAxis } from "#lib/reports/view.js";
  import ReportBox from "./ReportBox.svelte";

  const MIN_SHARE = 0.01;
  const HEIGHT_BUDGET = 360;
  const MIN_HEIGHT = 80;

  let {
    year,
    cursor,
    own,
    groups,
  }: {
    year: string;
    cursor: string;
    own: Item<Account>[] | undefined;
    groups: Item<TransactionGroup>[];
  } = $props();

  const report = useReport();
  const now = today();
  const start = $derived(addDays(`${year}-01-01`, -1));
  const end = $derived(year === now.slice(0, 4) ? now : `${year}-12-31`);
  const ids = $derived(
    (own ?? [])
      .filter((a) => a.attributes.include_net_worth !== false)
      .map((a) => a.id)
  );
  const chart = createQuery(() => ({
    ...reportQueries.chart(start, end, "1D", ids),
    enabled: ids.length > 0,
  }));
  const months = $derived(buckets(`${year}-01-01`, `${year}-12-31`, "month"));

  const totals = $derived.by(() => {
    const byCode = new Map<string, Map<string, number>>();
    for (const set of chart.data ?? []) {
      const code = set.currency_code ?? "";
      const days = byCode.get(code) ?? new Map<string, number>();
      for (const [date, value] of Object.entries(set.entries ?? {})) {
        const day = date.slice(0, 10);
        days.set(day, (days.get(day) ?? 0) + Number(value));
      }
      byCode.set(code, days);
    }
    return byCode;
  });

  function closing(days: Map<string, number>, month: string) {
    const last = periodOf(`${month}-01`, "1M").end;
    let found: number | undefined;
    let at = "";
    for (const [day, value] of days) {
      if (day <= last && day <= end && day >= at) {
        at = day;
        found = value;
      }
    }
    return month <= monthOf(end) ? found : undefined;
  }

  const rate = $derived(impliedRates(groups));
  const primary = $derived(plainCode(report.codes[0] ?? ""));

  const measured = $derived(
    [...totals.entries()]
      .sort((a, b) => report.codes.indexOf(a[0]) - report.codes.indexOf(b[0]))
      .map(([code, days]) => {
        const values = months.map((month) => closing(days, month));
        const peak = Math.max(0, ...values.map((v) => Math.abs(v ?? 0)));
        const r = rate(code, primary);
        return {
          code,
          last: values.findLast((v) => v !== undefined) ?? 0,
          values,
          weight: r === null ? null : peak * r,
        };
      })
  );
  const total = $derived(measured.reduce((sum, m) => sum + (m.weight ?? 0), 0));
  const share = (weight: number | null) =>
    weight === null || total === 0 ? null : weight / total;

  const all = $derived<Lane[]>(
    measured.map((m) => ({
      axisFormat: modeAxis(m.code),
      format: (value: number) => money(m.code, value, false, 0),
      height: Math.max(
        MIN_HEIGHT,
        Math.round((share(m.weight) ?? 1 / measured.length) * HEIGHT_BUDGET)
      ),
      key: m.code,
      keys: [{ color: "var(--ff-series-1)", key: "value", label: "Net worth" }],
      label: m.code,
      rows: months.map((month, i) => ({
        key: month,
        label: shortMonth(month),
        values: Object.fromEntries(
          m.values[i] === undefined ? [] : [["value", m.values[i]]]
        ),
      })),
    }))
  );
  const merged = $derived(mergeLanes(all));
  const joined = $derived(merged !== all);
  const big = (m: (typeof measured)[number]) =>
    (share(m.weight) ?? 1) >= MIN_SHARE;
  const lanes = $derived(
    joined ? merged : all.filter((_, i) => big(measured[i]))
  );
  const small = $derived(joined ? [] : measured.filter((m) => !big(m)));
</script>

<ReportBox
  body="px-3 pt-2 pb-3"
  empty={measured.length === 0}
  emptyText="No accounts count towards net worth."
  id="net-worth"
  loading={chart.isPending && ids.length > 0}
  title="Net worth"
>
  <Lanes
    {cursor}
    label="Net worth by currency"
    {lanes}
    legend={false}
    title={(row) =>
      row.key === monthOf(now) ? "today" : `end of ${longMonth(row.key)}`}
  />
  {#each small as m (m.code)}
    <p
      class="flex items-baseline gap-x-3 border-cladd-outline border-t pt-1.5 text-[12px]"
    >
      <span class="w-10 font-semibold text-cladd-fg">{m.code}</span>
      <span class="num font-semibold text-cladd-fg"
        >{money(m.code, m.last, false, 0)}</span
      >
    </p>
  {/each}
</ReportBox>
