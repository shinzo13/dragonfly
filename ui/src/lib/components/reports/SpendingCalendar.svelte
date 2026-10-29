<script lang="ts">
  import { addDays, daysBetween, eachDay, parse } from "#lib/dates.js";
  import { compactMoney, formatDate, formatMoney } from "#lib/format.js";
  import { daily } from "#lib/reports/flows.js";
  import {
    currencyMeta,
    drillQuery,
    modeLabel,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import ReportBox from "./ReportBox.svelte";

  const STEPS = [14, 30, 48, 68, 88];
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const BIG_CELL_DAYS = 62;
  const TOP_DAYS = 5;

  const report = useReport();
  const p = $derived(report.params);
  const mode = $derived(report.mode);
  let width = $state(0);
  let cursor = $state<string | null>(null);

  const spending = $derived(
    report.flows ? daily(report.flows, mode, -1) : null
  );
  const days = $derived(eachDay(p));
  const big = $derived(days.length <= BIG_CELL_DAYS);
  const values = $derived(
    [...(spending?.values() ?? [])].map((d) => d.value).sort((a, b) => a - b)
  );
  const thresholds = $derived(
    STEPS.slice(1).map(
      (_, i) =>
        values[Math.floor(((i + 1) / STEPS.length) * values.length)] ?? 0
    )
  );
  const top = $derived(
    [...(spending?.entries() ?? [])]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, TOP_DAYS)
  );
  const quiet = $derived(
    days.filter((d) => !spending?.has(d) && d <= p.end).length
  );
  const meta = $derived(
    mode === "pc"
      ? {
          decimals: 0,
          symbol: session.primary?.symbol ?? "",
        }
      : { decimals: 0, symbol: currencyMeta(mode).symbol }
  );

  function level(value: number) {
    let index = 0;
    while (index < thresholds.length && value > thresholds[index]) {
      index += 1;
    }
    return index;
  }

  const fill = (step: number) =>
    `color-mix(in oklch, var(--ff-expense) ${STEPS[step]}%, var(--cladd-surface))`;

  const monthShort = $derived(
    new Intl.DateTimeFormat(session.locale, { month: "short" })
  );

  const weekday = (day: string) => (parse(day).getDay() + 6) % 7;

  const months = $derived.by(() => {
    const list: { key: string; label: string; cells: (string | null)[] }[] = [];
    for (const day of days) {
      const key = day.slice(0, 7);
      let month = list.at(-1);
      if (month?.key !== key) {
        month = {
          cells: Array.from({ length: weekday(day) }, () => null),
          key,
          label: formatDate(`${key}-01`, "month"),
        };
        list.push(month);
      }
      month.cells.push(day);
    }
    return list;
  });

  const weeks = $derived.by(() => {
    if (big) {
      return [];
    }
    const first = addDays(p.start, -weekday(p.start));
    const count = Math.ceil((daysBetween(first, p.end) + 1) / 7);
    return Array.from({ length: count }, (_, w) =>
      Array.from({ length: 7 }, (__, d) => {
        const day = addDays(first, w * 7 + d);
        return day < p.start || day > p.end ? null : day;
      })
    );
  });
  const cellSize = $derived(
    big
      ? 0
      : Math.max(
          8,
          Math.min(16, Math.floor((width - 40) / Math.max(1, weeks.length)) - 2)
        )
  );

  function amount(value: number, compact: boolean) {
    return compact
      ? compactMoney(value, meta.symbol)
      : formatMoney({ amount: value, ...meta });
  }

  function open(day: string) {
    const current = report.drill;
    const same = current?.box === "calendar" && current.key === day;
    navigate(
      drillQuery(
        same
          ? null
          : {
              box: "calendar",
              dim: "day",
              dir: -1,
              key: day,
              label: formatDate(day, "long"),
            }
      )
    );
  }

  const focusDay = $derived(
    cursor ?? days.find((d) => spending?.has(d)) ?? p.start
  );

  function onkeydown(event: KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowDown: big ? 7 : 1,
      ArrowLeft: big ? -1 : -7,
      ArrowRight: big ? 1 : 7,
      ArrowUp: big ? -7 : -1,
    };
    if (event.key in moves) {
      event.preventDefault();
      const next = addDays(focusDay, moves[event.key]);
      if (next >= p.start && next <= p.end) {
        cursor = next;
        document.getElementById(`cal-${next}`)?.focus();
      }
    }
  }

  const label = (day: string) => {
    const value = spending?.get(day)?.value ?? 0;
    return `${formatDate(day, "long")}: ${value ? money(mode, -value) : "no spending"}`;
  };
</script>

<ReportBox
  body="p-3"
  empty={values.length === 0}
  emptyText="No spending in {modeLabel(mode)} in this period."
  id="calendar"
  loading={!spending}
  title="Daily spending ({modeLabel(mode)})"
>
  <div bind:clientWidth={width}>
    {#if big}
      <div class="flex flex-col gap-3">
        {#each months as month (month.key)}
          <div>
            {#if months.length > 1}
              <h3 class="mb-1 font-semibold text-[12px] text-cladd-fg-soft">
                {month.label}
              </h3>
            {/if}
            <div class="grid grid-cols-7 gap-0.5">
              {#each WEEKDAYS as name (name)}
                <div class="px-1 text-[11px] text-cladd-fg-soft">{name}</div>
              {/each}
              {#each month.cells as day, i (day ?? `pad-${i}`)}
                {#if day}
                  {@const value = spending?.get(day)?.value ?? 0}
                  {@const step = value ? level(value) : -1}
                  <button
                    aria-label={label(day)}
                    class="flex h-11 min-w-0 flex-col justify-between rounded-[4px] px-1.5 py-1 text-left {report
                      .drill?.box === "calendar" && report.drill.key === day
                      ? "outline-2 outline-cladd-fg"
                      : ""}"
                    id="cal-{day}"
                    onclick={() => open(day)}
                    onfocus={() => (cursor = day)}
                    {onkeydown}
                    tabindex={day === focusDay ? 0 : -1}
                    type="button"
                    style:background={step >= 0
                      ? fill(step)
                      : "var(--cladd-surface-next)"}
                    style:color={step >= 3 ? "white" : undefined}
                  >
                    <span class="num text-[11px] opacity-70"
                      >{Number(day.slice(8, 10))}</span
                    >
                    {#if value}
                      <span
                        class="num self-end truncate text-[12px] font-medium"
                        >{amount(value, width < 520)}</span
                      >
                    {/if}
                  </button>
                {:else}
                  <div></div>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div class="overflow-x-auto">
          <div class="flex gap-[2px]">
            <div class="mr-1 flex flex-col gap-[2px] pt-4">
              {#each WEEKDAYS as name, i (name)}
                <div
                  class="text-[10px] leading-none text-cladd-fg-soft"
                  style:height="{cellSize}px"
                >
                  {i % 2 === 0 ? name : ""}
                </div>
              {/each}
            </div>
            {#each weeks as week, w (w)}
              {@const firstDay = week.find((d) => d !== null)}
              <div class="flex flex-col gap-[2px]">
                <div
                  class="h-4 whitespace-nowrap text-[10px] text-cladd-fg-soft"
                  style:width="{cellSize}px"
                >
                  {#if firstDay &&
                    (w === 0 || Number(firstDay.slice(8, 10)) <= 7)}
                    {monthShort.format(parse(firstDay))}
                  {/if}
                </div>
                {#each week as day, d (d)}
                  {#if day}
                    {@const value = spending?.get(day)?.value ?? 0}
                    {@const step = value ? level(value) : -1}
                    <button
                      aria-label={label(day)}
                      class="rounded-[3px]"
                      id="cal-{day}"
                      onclick={() => open(day)}
                      onfocus={() => (cursor = day)}
                      {onkeydown}
                      tabindex={day === focusDay ? 0 : -1}
                      title={label(day)}
                      type="button"
                      style:background={step >= 0
                        ? fill(step)
                        : "var(--cladd-surface-next)"}
                      style:height="{cellSize}px"
                      style:width="{cellSize}px"
                    ></button>
                  {:else}
                    <div
                      style:height="{cellSize}px"
                      style:width="{cellSize}px"
                    ></div>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        </div>
        <div class="min-w-[14rem] flex-1">
          <h3 class="mb-1 font-semibold text-[12px] text-cladd-fg-soft">
            Biggest days
          </h3>
          <ul>
            {#each top as [day, info] (day)}
              <li>
                <button
                  class="flex h-7 w-full items-center justify-between gap-3 rounded-cladd-sm px-1 hover:bg-row-hover"
                  onclick={() => open(day)}
                  type="button"
                >
                  <span class="num text-cladd-fg-soft"
                    >{formatDate(day, "medium")}</span
                  >
                  <span class="text-[11px] text-cladd-fg-soft"
                    >{info.n}
                    {info.n === 1 ? "transaction" : "transactions"}</span
                  >
                  <span class="num ml-auto">{money(mode, -info.value)}</span>
                </button>
              </li>
            {/each}
          </ul>
          <p class="mt-2 text-[12px] text-cladd-fg-soft">
            {quiet}
            of {days.length} days without spending
          </p>
        </div>
      </div>
    {/if}
    <div
      class="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-cladd-fg-soft"
    >
      <span>Less</span>
      {#each STEPS as _, i (i)}
        <span
          class="inline-block size-3 rounded-[3px]"
          title={i === 0
            ? `up to ${amount(thresholds[0] ?? 0, false)}`
            : `over ${amount(thresholds[i - 1] ?? 0, false)}`}
          style:background={fill(i)}
        ></span>
      {/each}
      <span>More</span>
      {#if thresholds.length > 0}
        <span class="num ml-2"
          >over {amount(thresholds.at(-1) ?? 0, false)} is the darkest</span
        >
      {/if}
    </div>
  </div>
</ReportBox>
