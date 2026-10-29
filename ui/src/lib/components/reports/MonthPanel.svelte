<script lang="ts">
  import { formatDate } from "#lib/format.js";
  import { longMonth, type MonthFacts } from "#lib/reports/board.js";
  import type { Exchange } from "#lib/reports/flows.js";
  import {
    type Drill,
    drillQuery,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import { versusText } from "#lib/reports/typical.js";
  import ReportBox from "./ReportBox.svelte";

  let {
    facts,
    month,
    swaps,
    loading,
    partial = false,
    totals = true,
    monthDrill,
    class: className = "",
  }: {
    facts: MonthFacts[];
    month: string;
    swaps: Exchange[];
    loading: boolean;
    partial?: boolean;
    totals?: boolean;
    monthDrill: (extra: Partial<Drill>) => Drill;
    class?: string;
  } = $props();

  const report = useReport();
  const shown = $derived(facts.filter((f) => f.spent > 0 || f.earned > 0));
  const moved = $derived.by(() => {
    const pairs = new Map<
      string,
      { from: string; to: string; a: number; b: number }
    >();
    for (const swap of swaps) {
      const key = `${swap.from}>${swap.to}`;
      const pair = pairs.get(key) ?? {
        a: 0,
        b: 0,
        from: swap.from,
        to: swap.to,
      };
      pair.a += swap.fromAmount;
      pair.b += swap.toAmount;
      pairs.set(key, pair);
    }
    return [...pairs.values()];
  });

  function tone(ratio: number | null) {
    if (ratio === null || Math.abs(ratio) < 0.03) {
      return "text-cladd-fg-soft";
    }
    return ratio > 0 ? "text-expense" : "text-income";
  }

  function open(drill: Drill) {
    const current = report.drill;
    const same =
      current?.box === "month" &&
      current.key === drill.key &&
      current.dim === drill.dim &&
      current.currency === drill.currency;
    navigate(drillQuery(same ? null : drill));
  }

  const isOpen = (dim: string, key: string, code: string) =>
    report.drill?.box === "month" &&
    report.drill.dim === dim &&
    report.drill.key === key &&
    report.drill.currency === code;
</script>

<ReportBox
  body="px-3 py-2"
  class={className}
  empty={shown.length === 0}
  emptyText="Nothing spent or earned in {longMonth(month)}."
  id="month"
  {loading}
  title={longMonth(month)}
>
  <div class="flex flex-col gap-3">
    {#each shown as fact (fact.code)}
      <section class="flex flex-col gap-1">
        <h3 class="flex flex-wrap items-baseline gap-x-3 text-[13px]">
          <span class="w-10 font-semibold">{fact.code}</span>
          {#if totals}
            <span class="num font-semibold"
              >{money(fact.code, fact.spent, false, 0)}</span
            >
            <span class="text-cladd-fg-soft"
              >spent{partial ? " so far" : ""}</span
            >
            {#if fact.ratio !== null}
              <span class={tone(fact.ratio)}>{versusText(fact.ratio)}</span>
            {/if}
            {#if fact.earned > 0}
              <span class="num text-income"
                >{money(fact.code, fact.earned, false, 0)}</span
              >
              <span class="-ml-2 text-cladd-fg-soft">earned</span>
            {/if}
          {/if}
        </h3>
        <ul class="flex flex-col pl-[3.25rem] text-[13px]">
          {#each fact.places as place (place.id)}
            <li>
              <button
                class="grid h-6 w-full grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-3 rounded-cladd-sm px-1 text-left hover:bg-row-hover {isOpen(
                  "other",
                  place.id,
                  fact.code
                )
                  ? "bg-row-selected"
                  : ""}"
                onclick={() =>
                  open(
                    monthDrill({
                      currency: fact.code,
                      dim: "other",
                      key: place.id,
                      label: place.name,
                    })
                  )}
                type="button"
              >
                <span class="truncate">{place.name}</span>
                <span class="num text-right"
                  >{money(fact.code, place.value, false, 0)}</span
                >
                <span class="text-right text-[12px] text-cladd-fg-soft"
                  >{place.count === 1 ? "once" : `${place.count} times`}</span
                >
              </button>
            </li>
          {/each}
          {#if fact.day}
            {@const day = fact.day}
            <li>
              <button
                class="grid h-6 w-full grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-3 rounded-cladd-sm px-1 text-left hover:bg-row-hover {isOpen(
                  "day",
                  day.date,
                  fact.code
                )
                  ? "bg-row-selected"
                  : ""}"
                onclick={() =>
                  open({
                    box: "month",
                    currency: fact.code,
                    dim: "day",
                    dir: -1,
                    key: day.date,
                    label: formatDate(day.date, "long"),
                  })}
                type="button"
              >
                <span class="truncate text-cladd-fg-soft"
                  >Biggest day, {formatDate(day.date, "day")}:
                  {day.where}{day.count > 1
                    ? ` and ${day.count - 1} more`
                    : ""}</span
                >
                <span class="num text-right"
                  >{money(fact.code, day.value, false, 0)}</span
                >
                <span></span>
              </button>
            </li>
          {/if}
        </ul>
      </section>
    {/each}
    {#if moved.length > 0}
      <p class="flex flex-wrap gap-x-3 text-[12px] text-cladd-fg-soft">
        <span>Exchanged</span>
        {#each moved as pair (`${pair.from}${pair.to}`)}
          <span class="num"
            >{money(pair.from, pair.a, false, 0)}
            into {money(pair.to, pair.b, false, 0)}</span
          >
        {/each}
      </p>
    {/if}
  </div>
</ReportBox>
