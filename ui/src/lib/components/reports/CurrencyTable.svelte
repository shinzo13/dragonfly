<script lang="ts">
  import { formatNumber } from "#lib/format.js";
  import {
    type Board,
    longMonth,
    monthOf,
    shortMonth,
  } from "#lib/reports/board.js";
  import type { Exchange } from "#lib/reports/flows.js";
  import {
    drillQuery,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import { typical } from "#lib/reports/typical.js";
  import ReportBox from "./ReportBox.svelte";

  let { board, swaps }: { board: Board; swaps: Exchange[] } = $props();

  const report = useReport();

  type Kind = "spent" | "earned" | "moved";

  const LABELS: Record<Kind, string> = {
    earned: "Earned",
    moved: "Exchanged",
    spent: "Spent",
  };

  const moved = $derived.by(() => {
    const sums = new Map<string, Map<string, number>>();
    const add = (code: string, month: string, value: number) => {
      const byMonth = sums.get(code) ?? new Map<string, number>();
      byMonth.set(month, (byMonth.get(month) ?? 0) + value);
      sums.set(code, byMonth);
    };
    for (const swap of swaps) {
      add(swap.to, monthOf(swap.date), swap.toAmount);
      add(swap.from, monthOf(swap.date), -swap.fromAmount);
    }
    return sums;
  });

  const sources = $derived({
    earned: board.earned,
    moved,
    spent: board.spent,
  });

  const rows = $derived(
    board.codes.flatMap((code) =>
      (["spent", "earned", "moved"] as Kind[])
        .map((kind) => {
          const byMonth = sources[kind].get(code);
          return {
            byMonth,
            code,
            kind,
            total: board.months.reduce(
              (sum, m) => sum + (byMonth?.get(m) ?? 0),
              0
            ),
            typical:
              kind === "moved" ? null : typical(byMonth, board.typicalMonths),
          };
        })
        .filter((row) => board.months.some((m) => row.byMonth?.get(m)))
    )
  );

  const toneOf = (kind: Kind, value: number) => {
    if (kind === "spent") {
      return "text-expense";
    }
    if (kind === "earned") {
      return "text-income";
    }
    return value < 0 ? "text-cladd-fg-soft" : "text-transfer";
  };

  const cell = (kind: Kind, value: number) =>
    kind === "moved" ? formatNumber(value, 0, true) : formatNumber(value, 0);

  function open(code: string, kind: Kind, month: string) {
    const dir = kind === "spent" ? -1 : 1;
    const current = report.drill;
    const same =
      current?.box === "currencies" &&
      current.at === month &&
      current.currency === code &&
      current.dir === dir;
    navigate(
      drillQuery(
        same
          ? null
          : {
              at: month,
              box: "currencies",
              currency: code,
              dir,
              label: `${LABELS[kind]} in ${code}, ${longMonth(month)}`,
            }
      )
    );
  }
</script>

<ReportBox
  empty={rows.length === 0}
  id="currencies"
  loading={false}
  title="By currency"
>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr class="text-[12px] text-cladd-fg-soft">
          <th
            class="sticky left-0 z-[1] h-7 bg-cladd-surface px-3 text-left font-medium"
          ></th>
          {#each board.months as month (month)}
            <th
              class="h-7 px-2 text-right font-medium {month === board.partial
                ? "italic"
                : ""}"
              title={longMonth(month)}
            >
              {shortMonth(month)}
            </th>
          {/each}
          <th class="h-7 whitespace-nowrap px-2 text-right font-medium">
            Typical
          </th>
          <th class="h-7 px-3 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (`${row.code}-${row.kind}`)}
          {@const first = i === 0 || rows[i - 1].code !== row.code}
          <tr
            class="h-7 hover:bg-row-hover {first
              ? "border-cladd-outline border-t-2"
              : "border-cladd-outline border-t"}"
          >
            <th
              class="sticky left-0 z-[1] whitespace-nowrap bg-cladd-surface px-3 text-left font-normal"
              scope="row"
            >
              <span class="inline-block w-10 font-semibold"
                >{first ? row.code : ""}</span
              >
              <span class="text-cladd-fg-soft">{LABELS[row.kind]}</span>
            </th>
            {#each board.months as month (month)}
              {@const value = row.byMonth?.get(month) ?? 0}
              {@const active =
                report.drill?.box === "currencies" &&
                report.drill.at === month &&
                report.drill.currency === row.code &&
                report.drill.dir === (row.kind === "spent" ? -1 : 1)}
              <td class="p-0 text-right">
                {#if value && row.kind !== "moved"}
                  <button
                    class="num h-7 w-full whitespace-nowrap px-2 text-right hover:bg-row-cursor {toneOf(
                      row.kind,
                      value
                    )} {active ? "bg-row-selected font-semibold" : ""}"
                    onclick={() => open(row.code, row.kind, month)}
                    tabindex="-1"
                    title="{LABELS[row.kind]} in {row.code}, {longMonth(month)}"
                    type="button"
                  >
                    {cell(row.kind, value)}
                  </button>
                {:else if value}
                  <span
                    class="num block whitespace-nowrap px-2 {toneOf(
                      row.kind,
                      value
                    )}"
                    >{cell(row.kind, value)}</span
                  >
                {/if}
              </td>
            {/each}
            <td
              class="num whitespace-nowrap px-2 text-right text-cladd-fg-soft"
            >
              {row.typical === null ? "" : formatNumber(row.typical, 0)}
            </td>
            <td class="num whitespace-nowrap px-3 text-right font-semibold">
              {cell(row.kind, row.total)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</ReportBox>
