<script lang="ts">
  import { addDays, parse } from "#lib/dates.js";
  import { compactMoney, currentLocale, formatDate } from "#lib/format.js";
  import { type Need, STRIP_DAYS, UNKNOWN } from "#lib/subscriptions/runway.js";
  import Money from "./Money.svelte";

  let { needs, day, end }: { needs: Need[]; day: string; end: string } =
    $props();

  const THOUSAND = 1000;
  const SUNDAY = 0;
  const SATURDAY = 6;

  const days = $derived(
    Array.from({ length: STRIP_DAYS + 1 }, (_, i) => addDays(day, i))
  );

  const rows = $derived(
    needs.map((need) => {
      const main = need.currency;
      let running = 0;
      const cells = days.map((date) => {
        const list = need.dues.filter((d) => d.date === date);
        const code = main?.code ?? list[0]?.pay.code;
        const amount = list
          .filter((d) => d.pay.code === code)
          .reduce((acc, d) => acc + d.pay.amount, 0);
        running += amount;
        return {
          amount,
          count: list.length,
          date,
          fill: need.balance ? Math.min(1, running / need.balance) : 0,
          label: compactMoney(amount < THOUSAND ? Math.round(amount) : amount),
          names: list.map((d) => d.bill.attributes.name).join(", "),
          over: need.short !== null && date >= need.short.date,
        };
      });
      return { cells, need };
    })
  );

  function dayTone(date: string, i: number) {
    if (i === 0) {
      return "font-semibold text-cladd-fg";
    }
    return [SUNDAY, SATURDAY].includes(parse(date).getDay())
      ? "text-cladd-fg-softest"
      : "text-cladd-fg-softer";
  }
  const month = $derived(
    new Intl.DateTimeFormat(currentLocale(), { month: "short" })
  );
  const monthMark = (date: string, i: number) =>
    i === 0 || date.endsWith("-01") ? month.format(parse(date)) : "";
</script>

<div class="overflow-x-auto">
  <div
    class="grid min-w-[60rem] pb-2 text-[11px]"
    style:grid-template-columns="minmax(8rem, 11rem) repeat({days.length}, minmax(1.5rem, 1fr)) minmax(6.5rem, 8rem)"
  >
    <div class="sticky left-0 bg-cladd-surface"></div>
    {#each days as date, i (date)}
      <div
        class="ps-0.5 pt-2 font-semibold text-cladd-fg-soft {date > end
          ? "opacity-50"
          : ""}"
      >
        {monthMark(date, i)}
      </div>
    {/each}
    <div></div>
    <div class="sticky left-0 bg-cladd-surface"></div>
    {#each days as date, i (date)}
      <div
        class="num pb-1 text-center {dayTone(date, i)} {date > end
          ? "opacity-50"
          : ""}"
      >
        {Number(date.slice(8))}
      </div>
    {/each}
    <div class="pe-3 pb-1 text-right text-cladd-fg-softer">
      by {formatDate(days.at(-1), "short")}
    </div>
    {#each rows as row (row.need.id)}
      <div
        class="sticky left-0 z-10 flex h-7 items-center truncate border-cladd-outline/60 border-t bg-cladd-surface ps-3 pe-2 font-medium text-[12px] {row
          .need.id === UNKNOWN
          ? "text-warn"
          : "text-cladd-fg"}"
      >
        <span class="truncate">{row.need.name}</span>
      </div>
      {#each row.cells as cell (cell.date)}
        <div
          class="relative h-7 border-cladd-outline/60 border-t border-l {cell.date >
          end
            ? "opacity-50"
            : ""} {cell.over && cell.date === row.need.short?.date
            ? "outline-2 outline-expense -outline-offset-2"
            : ""}"
          title={cell.names
            ? `${formatDate(cell.date, "day")}: ${cell.names}`
            : undefined}
        >
          <div
            class="absolute inset-x-0 bottom-0 {cell.over
              ? "bg-expense/25"
              : "bg-brand/15"}"
            style:height="{cell.over ? 100 : cell.fill * 100}%"
          ></div>
          {#if cell.count}
            <span
              class="num relative flex h-full items-center justify-center font-semibold {cell.over
                ? "text-expense"
                : "text-cladd-fg"}"
              >{cell.label}</span
            >
          {/if}
        </div>
      {/each}
      <div
        class="flex h-7 items-center justify-end gap-1 whitespace-nowrap border-cladd-outline/60 border-t border-l pe-3 font-semibold text-[12px] {row
          .need.short
          ? "text-expense"
          : "text-cladd-fg"}"
      >
        {#each row.need.totals as total, i (total.code)}
          {i > 0 ? "+" : ""}<Money {...total} exact />
        {/each}
      </div>
    {/each}
  </div>
</div>
