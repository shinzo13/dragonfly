<script lang="ts">
  import type { StackKey } from "#lib/components/charts/chart.js";
  import Sparkline from "#lib/components/charts/Sparkline.svelte";
  import { type Grew, longMonth, shortMonth } from "#lib/reports/board.js";
  import {
    type Drill,
    drillQuery,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import { versusText } from "#lib/reports/typical.js";
  import ReportBox from "./ReportBox.svelte";

  const SHOWN = 10;

  let {
    rows,
    cursor,
    codes,
    colors,
    loading,
    partial = false,
    monthDrill,
    class: className = "",
  }: {
    rows: Grew[];
    cursor: string;
    codes: number;
    colors: StackKey[];
    loading: boolean;
    partial?: boolean;
    monthDrill: (extra: Partial<Drill>) => Drill;
    class?: string;
  } = $props();

  const report = useReport();
  let all = $state(false);

  const shown = $derived(all ? rows : rows.slice(0, SHOWN));
  const marker = $derived(Number(cursor.slice(5, 7)) - 1);
  const colorOf = (cat: string) =>
    colors.find((k) => k.key === cat)?.color ?? "var(--cladd-fg-softer)";

  function tone(ratio: number | null) {
    if (ratio === null || Math.abs(ratio) < 0.03) {
      return "text-cladd-fg-soft";
    }
    return ratio > 0 ? "text-expense" : "text-income";
  }

  function open(row: Grew) {
    const drill = monthDrill({
      currency: row.code,
      dim: "category",
      key: row.cat,
      label: row.label,
    });
    const current = report.drill;
    const same =
      current?.box === "grew" &&
      current.key === row.cat &&
      current.currency === row.code;
    navigate(drillQuery(same ? null : drill));
  }
</script>

<ReportBox
  class={className}
  empty={rows.length === 0}
  emptyText="No spending yet."
  id="grew"
  {loading}
  title="What grew"
>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr class="text-[12px] text-cladd-fg-soft">
          <th class="h-7 px-3 text-left font-medium">Category</th>
          <th class="h-7 px-2 text-left font-medium max-sm:hidden">
            This year
          </th>
          <th class="h-7 px-2 text-right font-medium max-sm:hidden">Total</th>
          <th class="h-7 whitespace-nowrap px-2 text-right font-medium">
            {shortMonth(cursor)}{partial ? " so far" : ""}
          </th>
          <th class="h-7 px-3 text-right font-medium">Against typical</th>
        </tr>
      </thead>
      <tbody>
        {#each shown as row (row.key)}
          {@const active =
            report.drill?.box === "grew" &&
            report.drill.key === row.cat &&
            report.drill.currency === row.code}
          <tr
            class="h-7 border-cladd-outline border-t hover:bg-row-hover {active
              ? "bg-row-selected"
              : ""}"
          >
            <td class="max-w-[14rem] px-3">
              <button
                class="flex max-w-full items-center gap-2 text-left hover:underline"
                onclick={() => open(row)}
                title="Show {row.label} in {longMonth(cursor)}"
                type="button"
              >
                <span
                  aria-hidden="true"
                  class="size-2.5 shrink-0 rounded-[3px]"
                  style:background={colorOf(row.cat)}
                ></span>
                <span class="truncate">{row.label}</span>
                {#if codes > 1}
                  <span class="text-[12px] text-cladd-fg-soft">{row.code}</span>
                {/if}
              </button>
            </td>
            <td class="px-2 max-sm:hidden">
              <Sparkline
                color={colorOf(row.cat)}
                height={20}
                {marker}
                values={row.values}
                width={96}
              />
            </td>
            <td class="num whitespace-nowrap px-2 text-right max-sm:hidden">
              {money(row.code, row.year, false, 0)}
            </td>
            <td class="num whitespace-nowrap px-2 text-right">
              {money(row.code, row.month, false, 0)}
            </td>
            <td class="whitespace-nowrap px-3 text-right {tone(row.ratio)}">
              {#if row.ratio !== null}
                {versusText(row.ratio, "")}
              {:else if row.month > 0}
                new
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if rows.length > SHOWN}
    <button
      class="mx-3 my-2 text-[12px] text-brand hover:underline dark:text-[var(--ff-series-1)]"
      onclick={() => (all = !all)}
      type="button"
    >
      {all ? "Show fewer" : `Show all ${rows.length}`}
    </button>
  {/if}
</ReportBox>
