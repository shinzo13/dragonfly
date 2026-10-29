<script lang="ts">
  import Box from "#lib/components/Box.svelte";
  import {
    type Board,
    headlines,
    longMonth,
    ordinal,
    shortMonth,
  } from "#lib/reports/board.js";
  import { money } from "#lib/reports/report.svelte.js";
  import { versus, versusText } from "#lib/reports/typical.js";

  let {
    board,
    month = null,
  }: { board: Board | undefined; month?: string | null } = $props();

  const rows = $derived(
    board ? headlines(board, month ? [month] : board.months) : []
  );
  const year = $derived(board?.months[0]?.slice(0, 4) ?? "");
  const period = $derived(month ? longMonth(month) : year);
  const showPace = $derived(rows.some((row) => row.pace));
  const byDay = $derived(
    `Typical by the ${ordinal(Number(board?.now.slice(8, 10) ?? 0))}`
  );

  const tone = (ratio: number | null) => {
    if (ratio === null || Math.abs(ratio) < 0.03) {
      return "text-cladd-fg-soft";
    }
    return ratio > 0 ? "text-expense" : "text-income";
  };
</script>

<Box body="px-3 py-2">
  {#if !board}
    <p class="py-2 text-cladd-fg-soft">Loading</p>
  {:else if rows.length === 0}
    <p class="py-2 text-cladd-fg-soft">No spending or income in {period}.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="border-collapse text-[13px]">
        <thead>
          <tr
            class="whitespace-nowrap text-left text-[12px] text-cladd-fg-soft"
          >
            <th class="w-12 pr-3 font-medium"></th>
            <th class="pr-10 font-medium">Spent in {period}</th>
            {#if showPace && !month}
              <th class="pr-10 font-medium">
                {shortMonth(board.partial ?? "")}
                so far
              </th>
            {/if}
            {#if showPace}
              <th class="pr-10 font-medium">{byDay}</th>
            {/if}
            <th class="pr-10 font-medium">Typical month</th>
            <th class="font-medium">Earned in {period}</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.code)}
            {@const pace = row.pace}
            {@const paceRatio = pace ? versus(pace.sofar, pace.typical) : null}
            <tr class="h-9">
              <th class="pr-3 text-left font-semibold" scope="row">
                {row.code}
              </th>
              <td class="pr-10 sm:whitespace-nowrap">
                <span class="num font-semibold text-[18px] tracking-[-0.01em]"
                  >{money(
                    row.code,
                    month && pace ? pace.sofar : row.spent,
                    false,
                    0
                  )}</span
                >
                {#if month}
                  {@const ratio = pace
                    ? paceRatio
                    : versus(row.spent, row.typical)}
                  <span
                    class="ml-2 whitespace-nowrap max-sm:ml-0 max-sm:block max-sm:text-[12px] {tone(
                      ratio
                    )}"
                    >{versusText(ratio)}</span
                  >
                {/if}
              </td>
              {#if showPace && !month}
                <td class="pr-10 sm:whitespace-nowrap">
                  {#if pace}
                    <span class="num"
                      >{money(row.code, pace.sofar, false, 0)}</span
                    >
                    <span
                      class="ml-2 whitespace-nowrap max-sm:ml-0 max-sm:block max-sm:text-[12px] {tone(
                        paceRatio
                      )}"
                      >{versusText(paceRatio)}</span
                    >
                  {/if}
                </td>
              {/if}
              {#if showPace}
                <td class="num whitespace-nowrap pr-10">
                  {#if pace}
                    {money(row.code, pace.typical, false, 0)}
                  {/if}
                </td>
              {/if}
              <td class="num whitespace-nowrap pr-10">
                {money(row.code, row.typical, false, 0)}
              </td>
              <td class="num whitespace-nowrap text-income">
                {#if row.earned}
                  {money(row.code, row.earned, false, 0)}
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</Box>
