<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import { formatNumber, percent } from "#lib/format.js";
  import {
    amountOf,
    type Dimension,
    merge,
    type Row,
    rank,
    type Side,
  } from "#lib/reports/flows.js";
  import {
    type Drill,
    drillQuery,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import Money from "./Money.svelte";

  interface Col {
    key: string;
    label: string;
    title?: string;
  }

  let {
    box,
    rows,
    cols,
    side,
    dim,
    dir,
    colIs = "at",
    itemDim,
    delta = false,
    average = false,
    nameLabel = "Name",
    multi = false,
  }: {
    box: string;
    rows: Row[];
    cols: Col[];
    side: Side;
    dim: Dimension;
    dir?: 1 | -1;
    colIs?: "at" | "asset" | "item";
    itemDim?: Dimension;
    delta?: boolean;
    average?: boolean;
    nameLabel?: string;
    multi?: boolean;
  } = $props();

  const report = useReport();
  const mode = $derived(report.mode);

  const sorted = $derived(
    multi
      ? rank(rows, mode, side)
      : rank(rows, mode, side).filter(
          (row) => amountOf(row.totals, mode, side) !== 0
        )
  );
  const colMerged = $derived(
    multi
      ? cols.map((col) => merge(sorted.map((row) => row.cells.get(col.key))))
      : []
  );
  const sign = $derived(side === "out" ? -1 : 1);
  const compact = $derived(cols.length > 6);
  const short = (value: number) =>
    compact ? formatNumber(value, 0) : money(mode, value);
  const colTotals = $derived(
    cols.map((col) =>
      sorted.reduce(
        (sum, row) => sum + amountOf(row.cells.get(col.key), mode, side),
        0
      )
    )
  );
  const grand = $derived(colTotals.reduce((a, b) => a + b, 0));

  function cellDrill(row: Row | null, col: Col | null): Drill {
    const label = [row?.label, col?.title ?? col?.label]
      .filter(Boolean)
      .join(", ");
    if (colIs === "item") {
      return {
        asset: row && col ? row.key : undefined,
        box,
        dim: col ? itemDim : dim,
        dir,
        key: col ? col.key : row?.key,
        label,
      };
    }
    return {
      asset: colIs === "asset" ? col?.key : undefined,
      at: colIs === "at" ? col?.key : undefined,
      box,
      dim: row ? dim : undefined,
      dir,
      key: row?.key,
      label,
    };
  }

  function isActive(row: Row | null, col: Col | null) {
    const current = report.drill;
    if (current?.box !== box) {
      return false;
    }
    const next = cellDrill(row, col);
    return (
      current.key === next.key &&
      current.at === next.at &&
      current.asset === next.asset
    );
  }

  function open(row: Row | null, col: Col | null) {
    navigate(drillQuery(isActive(row, col) ? null : cellDrill(row, col)));
  }

  function change(row: Row, index: number) {
    if (index === 0) {
      return null;
    }
    const now = amountOf(row.cells.get(cols[index].key), mode, side);
    const before = amountOf(row.cells.get(cols[index - 1].key), mode, side);
    if (!(before || now)) {
      return null;
    }
    const ratio = before ? (now - before) / Math.abs(before) : null;
    const up = now > before;
    const good = side === "out" ? !up : up;
    return { good, ratio, up };
  }
</script>

<div class="mx-px mb-px overflow-x-auto">
  <table class="w-full border-collapse text-[13px]">
    <thead>
      <tr class="text-[12px] text-cladd-fg-soft">
        <th
          class="sticky left-0 z-[1] h-7 bg-cladd-surface px-3 text-left font-medium"
        >
          {nameLabel}
        </th>
        {#each cols as col (col.key)}
          <th
            class="h-7 whitespace-nowrap px-2 text-right font-medium"
            title={col.title}
          >
            {col.label}
          </th>
        {/each}
        {#if average}
          <th class="h-7 whitespace-nowrap px-2 text-right font-medium">
            Average
          </th>
        {/if}
        <th class="h-7 whitespace-nowrap px-3 text-right font-medium">Sum</th>
      </tr>
    </thead>
    <tbody>
      {#each sorted as row (row.key)}
        {@const rowTotal = amountOf(row.totals, mode, side)}
        <tr class="h-7 border-cladd-outline border-t hover:bg-row-hover">
          <th
            class="sticky left-0 z-[1] max-w-[16rem] bg-cladd-surface px-3 text-left font-normal"
            scope="row"
          >
            <button
              aria-pressed={isActive(row, null)}
              class="block max-w-full truncate text-left hover:text-brand dark:hover:text-[var(--ff-series-1)] hover:underline {isActive(
                row,
                null
              )
                ? "font-semibold text-brand dark:text-[var(--ff-series-1)]"
                : ""}"
              onclick={() => open(row, null)}
              title="Show transactions for {row.label}"
              type="button"
            >
              {row.label}
            </button>
          </th>
          {#each cols as col, i (col.key)}
            {@const value = amountOf(row.cells.get(col.key), mode, side)}
            {@const diff = delta ? change(row, i) : null}
            {@const cell = row.cells.get(col.key)}
            <td class="p-0 text-right">
              {#if multi && cell}
                <button
                  class="w-full px-2 py-1 text-right hover:bg-row-cursor {isActive(
                    row,
                    col
                  )
                    ? "bg-row-selected font-semibold"
                    : ""}"
                  onclick={() => open(row, col)}
                  tabindex="-1"
                  title="{row.label}, {col.title ?? col.label}"
                  type="button"
                >
                  <Money codes={report.codes} {side} totals={cell} />
                </button>
              {:else if !multi && (value || diff)}
                <button
                  class="num h-7 w-full whitespace-nowrap px-2 text-right hover:bg-row-cursor {isActive(
                    row,
                    col
                  )
                    ? "bg-row-selected font-semibold"
                    : ""}"
                  onclick={() => open(row, col)}
                  tabindex="-1"
                  title="{row.label}, {col.title ?? col.label}: {money(
                    mode,
                    sign * value
                  )}"
                  type="button"
                >
                  {#if diff}
                    <span
                      class="inline-flex items-center gap-0.5 {diff.good
                        ? "text-income"
                        : "text-expense"}"
                    >
                      {#if diff.up}
                        <ArrowUp aria-label="up" class="size-3" />
                      {:else}
                        <ArrowDown aria-label="down" class="size-3" />
                      {/if}
                      {diff.ratio === null
                        ? "new"
                        : percent(Math.abs(diff.ratio))}
                    </span>
                  {:else}
                    {short(sign * value)}
                  {/if}
                </button>
              {/if}
            </td>
          {/each}
          {#if average}
            <td
              class="num whitespace-nowrap px-2 text-right text-cladd-fg-soft"
            >
              {short((sign * rowTotal) / Math.max(1, cols.length))}
            </td>
          {/if}
          <td class="num whitespace-nowrap px-3 text-right font-semibold">
            {#if multi}
              <Money codes={report.codes} {side} totals={row.totals} />
            {:else}
              {short(sign * rowTotal)}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr class="h-7 border-cladd-outline border-t-2 font-semibold">
        <th
          class="sticky left-0 z-[1] bg-cladd-surface px-3 text-left"
          scope="row"
        >
          Sum
        </th>
        {#each cols as col, i (col.key)}
          <td class="p-0 text-right">
            {#if multi}
              <div class="px-2 py-1">
                <Money codes={report.codes} {side} totals={colMerged[i]} />
              </div>
            {:else if colTotals[i]}
              <button
                class="num h-7 w-full whitespace-nowrap px-2 text-right hover:bg-row-cursor {isActive(
                  null,
                  col
                )
                  ? "bg-row-selected"
                  : ""}"
                onclick={() => open(null, col)}
                tabindex="-1"
                type="button"
              >
                {short(sign * colTotals[i])}
              </button>
            {/if}
          </td>
        {/each}
        {#if average}
          <td class="num whitespace-nowrap px-2 text-right">
            {short((sign * grand) / Math.max(1, cols.length))}
          </td>
        {/if}
        <td class="num whitespace-nowrap px-3 text-right">
          {#if multi}
            <Money codes={report.codes} {side} totals={merge(colMerged)} />
          {:else}
            {short(sign * grand)}
          {/if}
        </td>
      </tr>
    </tfoot>
  </table>
</div>
