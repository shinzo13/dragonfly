<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { formatRange } from "#lib/format.js";
  import { displayFlows } from "#lib/reports/display.js";
  import {
    currencies,
    measureOf,
    type Totals,
    toFlows,
    total,
  } from "#lib/reports/flows.js";
  import { shiftRange } from "#lib/reports/params.js";
  import { reportQueries } from "#lib/reports/queries.js";
  import {
    drillQuery,
    modeLabel,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import Delta from "./Delta.svelte";
  import ReportBox from "./ReportBox.svelte";

  const report = useReport();
  const previous = $derived(shiftRange(report.params, -1));
  const earlier = createQuery(() =>
    reportQueries.transactions(previous.start, previous.end)
  );
  const before = $derived(
    earlier.data && report.accountsReady
      ? total(
          displayFlows(
            toFlows(
              earlier.data,
              new Set(report.selected),
              (id) => report.byId().get(id)?.currency_code
            ),
            report.into
          )
        )
      : undefined
  );
  const was = (code: string) =>
    before && (code !== "pc" || before.pcOk)
      ? measureOf(before, code)
      : undefined;

  const rows = $derived.by(() => {
    const totals: Totals | undefined = report.totals;
    if (!totals) {
      return [];
    }
    const list = currencies(totals, report.codes).map((code) => {
      const m = totals.cur.get(code) ?? { in: 0, n: 0, out: 0 };
      return { code, in: m.in, label: code, out: m.out };
    });
    if (totals.pcOk && list.length > 1) {
      list.push({
        code: "pc",
        in: totals.pc.in,
        label: modeLabel("pc"),
        out: totals.pc.out,
      });
    }
    return list;
  });

  function open(dir: 1 | -1) {
    const label = dir === 1 ? "Money in" : "Money out";
    const current = report.drill;
    const same = current?.box === "operations" && current.dir === dir;
    navigate(drillQuery(same ? null : { box: "operations", dir, label }));
  }
</script>

<ReportBox
  empty={rows.length === 0}
  id="operations"
  loading={!report.totals}
  title="Income vs. expenses"
>
  {#snippet tools()}
    {#if before && before.n > 0}
      <span class="text-[12px] text-cladd-fg-soft"
        >Change against {formatRange(previous.start, previous.end)}</span
      >
    {/if}
  {/snippet}
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr class="text-[12px] text-cladd-fg-soft">
          <th class="h-7 px-3 text-left font-medium">Currency</th>
          <th class="h-7 px-3 text-right font-medium">In</th>
          <th class="h-7 px-3 text-right font-medium">Out</th>
          <th class="h-7 px-3 text-right font-medium">Difference</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.code)}
          <tr
            class="h-7 border-cladd-outline border-t hover:bg-row-hover {row.code ===
            "pc"
              ? "font-semibold"
              : ""}"
          >
            <td class="px-3">{row.label}</td>
            <td class="p-0 text-right">
              <button
                class="num h-7 w-full px-3 text-right text-income hover:bg-row-cursor"
                onclick={() => open(1)}
                title="Show money in"
                type="button"
              >
                <Delta
                  before={was(row.code)?.in}
                  now={row.in}
                  title="Previous period: {money(
                    row.code,
                    was(row.code)?.in ?? 0
                  )}"
                  upIsGood
                />
                {money(row.code, row.in)}
              </button>
            </td>
            <td class="p-0 text-right">
              <button
                class="num h-7 w-full px-3 text-right text-expense hover:bg-row-cursor"
                onclick={() => open(-1)}
                title="Show money out"
                type="button"
              >
                <Delta
                  before={was(row.code)?.out}
                  now={row.out}
                  title="Previous period: {money(
                    row.code,
                    -(was(row.code)?.out ?? 0)
                  )}"
                  upIsGood={false}
                />
                {money(row.code, -row.out)}
              </button>
            </td>
            <td
              class="num px-3 text-right {row.in - row.out < 0
                ? "text-expense"
                : "text-income"}"
            >
              {money(row.code, row.in - row.out, true)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</ReportBox>
