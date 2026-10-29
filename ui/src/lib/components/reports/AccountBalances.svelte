<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { displayCode, inDisplay } from "#lib/reports/display.js";
  import { reportQueries } from "#lib/reports/queries.js";
  import {
    displayMoney,
    drillQuery,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import ReportBox from "./ReportBox.svelte";

  const report = useReport();
  const p = $derived(report.params);
  const balances = createQuery(() => reportQueries.balances(p.start, p.end));

  const rows = $derived.by(() => {
    const { data } = balances;
    if (!data) {
      return [];
    }
    return report.selected
      .map((id) => {
        const account = report.byId().get(id);
        const start = data.before.get(id) ?? 0;
        const end = data.after.get(id) ?? 0;
        return {
          code: account?.currency_code ?? "",
          end,
          id,
          name: account?.name ?? `#${id}`,
          start,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  const sums = $derived.by(() => {
    const into = displayCode(new Set(rows.map((row) => row.code)));
    const map = new Map<string, { start: number; end: number }>();
    for (const row of rows) {
      const start = inDisplay(row.start, row.code, into);
      const end = inDisplay(row.end, row.code, into);
      const sum = map.get(start.code) ?? { end: 0, start: 0 };
      sum.start += start.amount;
      sum.end += end.amount;
      map.set(start.code, sum);
    }
    const order = report.codes;
    return [...map.entries()].sort(
      (a, b) => order.indexOf(a[0]) - order.indexOf(b[0])
    );
  });

  function tone(value: number) {
    if (value === 0) {
      return "text-cladd-fg-soft";
    }
    return value < 0 ? "text-expense" : "text-income";
  }

  function open(row: { id: string; name: string }) {
    const current = report.drill;
    const same = current?.box === "balances" && current.key === row.id;
    navigate(
      drillQuery(
        same
          ? null
          : { box: "balances", dim: "asset", key: row.id, label: row.name }
      )
    );
  }
</script>

<ReportBox
  id="balances"
  loading={!(balances.data && report.accountsReady)}
  title="Account balances"
>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[34rem] border-collapse text-[13px]">
      <thead>
        <tr class="text-[12px] text-cladd-fg-soft">
          <th class="h-7 w-full px-3 text-left font-medium">Name</th>
          <th class="h-7 w-32 px-3 text-right font-medium">
            Balance at start of period
          </th>
          <th class="h-7 w-32 px-3 text-right font-medium">
            Balance at end of period
          </th>
          <th class="h-7 w-32 px-3 text-right font-medium">Difference</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          {@const active =
            report.drill?.box === "balances" && report.drill.key === row.id}
          <tr
            class="h-7 border-cladd-outline border-t hover:bg-row-hover {active
              ? "bg-row-selected"
              : ""}"
          >
            <td class="max-w-0 px-3">
              <button
                aria-pressed={active}
                class="block max-w-full truncate text-left hover:text-brand dark:hover:text-[var(--ff-series-1)] hover:underline"
                onclick={() => open(row)}
                title="Show transactions"
                type="button"
              >
                {row.name}
              </button>
            </td>
            <td class="num px-3 text-right">
              {displayMoney(row.code, row.start)}
            </td>
            <td class="num px-3 text-right">
              {displayMoney(row.code, row.end)}
            </td>
            <td class="num px-3 text-right {tone(row.end - row.start)}">
              {displayMoney(row.code, row.end - row.start, true)}
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        {#each sums as [code, sum], i (code)}
          <tr
            class="h-7 font-semibold {i === 0
              ? "border-cladd-outline border-t-2"
              : ""}"
          >
            <td class="px-3">Sum ({code})</td>
            <td class="num px-3 text-right">{money(code, sum.start)}</td>
            <td class="num px-3 text-right">{money(code, sum.end)}</td>
            <td class="num px-3 text-right {tone(sum.end - sum.start)}">
              {money(code, sum.end - sum.start, true)}
            </td>
          </tr>
        {/each}
      </tfoot>
    </table>
  </div>
</ReportBox>
