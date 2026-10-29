<script lang="ts" module>
  export type ColumnKind =
    | "in"
    | "out"
    | "net"
    | "avg-in"
    | "avg-out"
    | "pct-in"
    | "pct-out"
    | "count";

  export interface Column {
    kind: ColumnKind;
    label: string;
  }
</script>

<script lang="ts">
  import { formatNumber, percent } from "#lib/format.js";
  import {
    currencies,
    type Dimension,
    type Measure,
    type Row,
    rank,
    type Side,
    type Totals,
  } from "#lib/reports/flows.js";
  import {
    drillQuery,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";

  let {
    box,
    rows,
    columns,
    dim,
    dir,
    footer,
    sort = "out",
    limit,
    nameLabel = "Name",
    counts = false,
    averageAll = false,
  }: {
    box: string;
    rows: Row[];
    columns: Column[];
    dim: Dimension;
    dir?: 1 | -1;
    footer?: Totals;
    sort?: Side;
    limit?: number;
    nameLabel?: string;
    counts?: boolean;
    averageAll?: boolean;
  } = $props();

  const report = useReport();
  let expanded = $state(false);

  const sorted = $derived(rank(rows, report.mode, sort));
  const shown = $derived(limit && !expanded ? sorted.slice(0, limit) : sorted);

  interface Line {
    code: string;
    text: string;
    tone: string;
  }

  function cell(
    kind: ColumnKind,
    m: Measure,
    whole: Measure | undefined,
    code: string
  ): Line | null {
    if (kind === "count") {
      return { code, text: formatNumber(m.n, 0), tone: "" };
    }
    if (kind === "pct-in" || kind === "pct-out") {
      const part = kind === "pct-in" ? m.in : m.out;
      const all = (kind === "pct-in" ? whole?.in : whole?.out) ?? 0;
      return part && all
        ? { code, text: percent(part / all, 1), tone: "" }
        : null;
    }
    const avg = kind === "avg-in" || kind === "avg-out";
    const base = { in: m.in, net: m.in - m.out, out: -m.out }[
      kind.replace("avg-", "") as "in" | "net" | "out"
    ];
    if (!base || (avg && m.n < (averageAll ? 1 : 2))) {
      return null;
    }
    const value = avg ? base / m.n : base;
    return {
      code,
      text: money(code, value),
      tone: value < 0 ? "text-expense" : "text-income",
    };
  }

  function lines(totals: Totals, kind: ColumnKind): Line[] {
    return currencies(totals, report.codes).flatMap((code) => {
      const m = totals.cur.get(code);
      const line = m ? cell(kind, m, footer?.cur.get(code), code) : null;
      return line ? [line] : [];
    });
  }

  function drill(row: Row) {
    const current = report.drill;
    const same =
      current?.box === box && current.key === row.key && current.dim === dim;
    navigate(
      drillQuery(
        same ? null : { box, dim, dir, key: row.key, label: row.label }
      )
    );
  }
</script>

<div class="overflow-x-auto">
  <table class="w-full border-collapse text-[13px]">
    <thead>
      <tr class="text-[12px] text-cladd-fg-soft">
        <th class="h-7 px-3 text-left font-medium">{nameLabel}</th>
        {#each columns as column (column.kind)}
          <th class="h-7 whitespace-nowrap px-3 text-right font-medium">
            {column.label}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each shown as row (row.key)}
        {@const active =
          report.drill?.box === box && report.drill.key === row.key}
        <tr
          class="border-cladd-outline border-t align-top hover:bg-row-hover {active
            ? "bg-row-selected"
            : ""}"
        >
          <td class="max-w-[18rem] px-3 py-1">
            <button
              aria-pressed={active}
              class="block max-w-full truncate text-left hover:text-brand dark:hover:text-[var(--ff-series-1)] hover:underline"
              onclick={() => drill(row)}
              title="Show transactions"
              type="button"
            >
              {row.label}
            </button>
            {#if counts && row.totals.n > 1}
              <span class="text-[11px] text-cladd-fg-soft"
                >{row.totals.n}
                transactions</span
              >
            {/if}
          </td>
          {#each columns as column (column.kind)}
            <td class="whitespace-nowrap px-3 py-1 text-right">
              {#each lines(row.totals, column.kind) as line (line.code)}
                <div class="num {line.tone}">{line.text}</div>
              {/each}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
    {#if footer && footer.n > 0}
      <tfoot>
        <tr class="border-cladd-outline border-t-2 align-top font-semibold">
          <td class="px-3 py-1">Sum</td>
          {#each columns as column (column.kind)}
            <td class="whitespace-nowrap px-3 py-1 text-right">
              {#if !(
                column.kind.startsWith("pct") || column.kind.startsWith("avg")
              )}
                {#each lines(footer, column.kind) as line (line.code)}
                  <div class="num {line.tone}">{line.text}</div>
                {/each}
              {/if}
            </td>
          {/each}
        </tr>
      </tfoot>
    {/if}
  </table>
</div>
{#if limit && sorted.length > limit}
  <button
    class="w-full border-cladd-outline border-t px-3 py-1.5 text-left text-[12px] text-brand dark:text-[var(--ff-series-1)] hover:underline"
    onclick={() => (expanded = !expanded)}
    type="button"
  >
    {expanded ? "Show top" : `Show entire list (${sorted.length})`}
  </button>
{/if}
