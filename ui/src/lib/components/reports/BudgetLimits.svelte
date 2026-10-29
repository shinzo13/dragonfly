<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { formatRange, percent } from "#lib/format.js";
  import { inDisplay } from "#lib/reports/display.js";
  import { NONE } from "#lib/reports/flows.js";
  import { reportQueries } from "#lib/reports/queries.js";
  import {
    drillQuery,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import ReportBox from "./ReportBox.svelte";

  let { class: className = "" }: { class?: string } = $props();

  const report = useReport();
  const p = $derived(report.params);
  const limits = createQuery(() => reportQueries.limits(p.start, p.end));

  interface Line {
    budgeted: number | null;
    budgetId: string;
    code: string;
    end: string;
    key: string;
    name: string;
    spent: number;
    start: string;
  }

  const lines = $derived.by(() => {
    const { flows } = report;
    if (!(flows && limits.data)) {
      return [];
    }
    const withdrawals = flows.filter(
      (f) => f.dir === -1 && f.type === "withdrawal"
    );
    const merged = new Map<string, Line>();
    for (const item of limits.data) {
      const a = item.attributes;
      const start = (a.start ?? p.start).slice(0, 10);
      const end = (a.end ?? p.end).slice(0, 10);
      const { amount, code } = inDisplay(
        Number(a.amount ?? 0),
        a.currency_code ?? "",
        report.into
      );
      const key = [a.budget_id, start, end, code].join("|");
      const found = merged.get(key);
      if (found) {
        found.budgeted = (found.budgeted ?? 0) + amount;
        continue;
      }
      merged.set(key, {
        budgeted: amount,
        budgetId: String(a.budget_id),
        code,
        end,
        key: item.id,
        name:
          report.itemName("budget", String(a.budget_id)) ?? `#${a.budget_id}`,
        spent: withdrawals
          .filter(
            (f) =>
              f.budget?.id === String(a.budget_id) &&
              f.currency === code &&
              f.date >= start &&
              f.date <= end
          )
          .reduce((sum, f) => sum + f.amount, 0),
        start,
      });
    }
    const result = [...merged.values()];
    result.sort(
      (a, b) => a.name.localeCompare(b.name) || a.start.localeCompare(b.start)
    );
    const none = new Map<string, number>();
    for (const f of withdrawals) {
      if (!f.budget) {
        none.set(f.currency, (none.get(f.currency) ?? 0) + f.amount);
      }
    }
    for (const [code, spent] of none) {
      result.push({
        budgeted: null,
        budgetId: NONE,
        code,
        end: p.end,
        key: `none-${code}`,
        name: `(no budget) (${code})`,
        spent,
        start: p.start,
      });
    }
    return result;
  });

  const sums = $derived.by(() => {
    const map = new Map<string, { budgeted: number; spent: number }>();
    for (const line of lines) {
      const sum = map.get(line.code) ?? { budgeted: 0, spent: 0 };
      sum.budgeted += line.budgeted ?? 0;
      sum.spent += line.spent;
      map.set(line.code, sum);
    }
    return [...map.entries()].sort(
      (a, b) => report.codes.indexOf(a[0]) - report.codes.indexOf(b[0])
    );
  });
  const sumOf = (code: string) => sums.find(([c]) => c === code)?.[1];

  function open(line: Line) {
    const current = report.drill;
    const same = current?.box === "budgets" && current.key === line.budgetId;
    navigate(
      drillQuery(
        same
          ? null
          : {
              box: "budgets",
              dim: "budget",
              dir: -1,
              key: line.budgetId,
              label: line.name,
            }
      )
    );
  }
</script>

<ReportBox
  class={className}
  empty={lines.length === 0}
  emptyText="No budgets or spending in this period."
  id="budgets"
  loading={!(report.flows && limits.data && report.budgets)}
  title="Budgets"
>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr class="text-[12px] text-cladd-fg-soft">
          <th class="h-7 px-3 text-left font-medium">Budget</th>
          <th class="h-7 px-3 text-left font-medium max-2xl:hidden">Date</th>
          <th class="h-7 px-3 text-right font-medium">Budgeted</th>
          <th class="h-7 px-2 text-right font-medium max-md:hidden">pct.</th>
          <th class="h-7 px-3 text-right font-medium">Spent</th>
          <th class="h-7 px-2 text-right font-medium max-md:hidden">pct.</th>
          <th class="h-7 px-3 text-right font-medium">Left</th>
          <th class="h-7 px-3 text-right font-medium">Overspent</th>
        </tr>
      </thead>
      <tbody>
        {#each lines as line (line.key)}
          {@const sum = sumOf(line.code)}
          {@const left = (line.budgeted ?? 0) - line.spent}
          {@const active =
            report.drill?.box === "budgets" &&
            report.drill.key === line.budgetId}
          <tr
            class="h-7 border-cladd-outline border-t hover:bg-row-hover {active
              ? "bg-row-selected"
              : ""}"
          >
            <td class="max-w-[14rem] px-3">
              <button
                aria-pressed={active}
                class="block max-w-full truncate text-left hover:text-brand dark:hover:text-[var(--ff-series-1)] hover:underline"
                onclick={() => open(line)}
                title="Show transactions"
                type="button"
              >
                {line.name}
              </button>
            </td>
            <td
              class="num whitespace-nowrap px-3 text-cladd-fg-soft max-2xl:hidden"
            >
              {#if line.budgeted !== null}
                {formatRange(line.start, line.end)}
              {/if}
            </td>
            <td class="num px-3 text-right">
              {#if line.budgeted !== null}
                {money(line.code, line.budgeted)}
              {/if}
            </td>
            <td class="num px-2 text-right text-cladd-fg-soft max-md:hidden">
              {#if line.budgeted && sum?.budgeted}
                {percent(line.budgeted / sum.budgeted)}
              {/if}
            </td>
            <td class="num px-3 text-right text-expense">
              {line.spent ? money(line.code, -line.spent) : ""}
            </td>
            <td class="num px-2 text-right text-cladd-fg-soft max-md:hidden">
              {#if line.spent && sum?.spent}
                {percent(line.spent / sum.spent)}
              {/if}
            </td>
            <td class="num px-3 text-right text-income">
              {#if line.budgeted !== null && left > 0}
                {money(line.code, left)}
              {/if}
            </td>
            <td class="num px-3 text-right text-expense">
              {#if line.budgeted !== null && left < 0}
                {money(line.code, -left)}
              {/if}
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
            <td class="max-2xl:hidden"></td>
            <td class="num px-3 text-right">{money(code, sum.budgeted)}</td>
            <td class="max-md:hidden"></td>
            <td class="num px-3 text-right text-expense">
              {money(code, -sum.spent)}
            </td>
            <td class="max-md:hidden"></td>
            <td colspan="2"></td>
          </tr>
        {/each}
      </tfoot>
    </table>
  </div>
</ReportBox>
