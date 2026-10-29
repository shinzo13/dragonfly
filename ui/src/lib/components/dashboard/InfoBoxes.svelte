<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import CalendarClock from "@lucide/svelte/icons/calendar-clock";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import Scale from "@lucide/svelte/icons/scale";
  import Wallet from "@lucide/svelte/icons/wallet";
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import type { Component, Snippet } from "svelte";
  import Meter from "#lib/components/charts/Meter.svelte";
  import {
    daysBetween,
    parse,
    periodOf,
    shiftPeriod,
    today,
  } from "#lib/dates.js";
  import { currentLocale, formatMoney } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { ALL_ASSETS, reportPath } from "#lib/reports/params.js";
  import { parseSummary, type SummaryEntry, summaryQuery } from "./data.js";

  const CURRENCY_SUFFIX = /\s*\(.*\)$/;

  interface Delta {
    good: boolean;
    text: string;
    up: boolean;
  }

  const current = createQuery(() => ({
    ...summaryQuery(period.start, period.end),
    placeholderData: keepPreviousData,
  }));
  const prevRange = $derived(shiftPeriod(period.range, period.view, -1));
  const previous = createQuery(() =>
    summaryQuery(prevRange.start, prevRange.end)
  );
  const now = $derived(parseSummary(current.data));
  const before = $derived(parseSummary(previous.data));
  const prevName = $derived.by(() => {
    const month = periodOf(prevRange.start, "1M");
    if (month.start === prevRange.start && month.end === prevRange.end) {
      return new Intl.DateTimeFormat(currentLocale(), {
        month: "short",
      }).format(parse(prevRange.start));
    }
    return "the period before";
  });
  const year = $derived(today().slice(0, 4));

  const absolute = (list: SummaryEntry[]) =>
    list.map((e) => ({ ...e, amount: Math.abs(e.amount) }));

  function lines(list: SummaryEntry[], abs = false): string[] {
    const parts = abs ? absolute(list) : list;
    return display.total(parts)
      ? [display.text(parts)]
      : parts.map((e) => formatMoney(e));
  }

  function flow(list: SummaryEntry[] | undefined, sign: number) {
    const parts = (list ?? []).map((e) => ({
      ...e,
      amount: sign * Math.abs(e.amount),
    }));
    return display.text(display.total(parts) ? parts : parts.slice(0, 1), true);
  }

  function compare(
    kind: string,
    words: [string, string],
    upIsGood = true
  ): Delta | null {
    const sum = display.total(now[kind] ?? []);
    const a = sum ?? now[kind]?.[0];
    const b = sum
      ? display.total(before[kind] ?? [])
      : a && before[kind]?.find((e) => e.code === a.code);
    if (!(a && b) || a.amount === b.amount) {
      return null;
    }
    const diff = a.amount - b.amount;
    const text = formatMoney({ ...a, amount: Math.abs(diff) });
    return {
      good: diff > 0 === upIsGood,
      text: `${sum?.converted ? "≈" : ""}${text} ${diff > 0 ? words[0] : words[1]}`,
      up: diff > 0,
    };
  }

  const balance = $derived(now.balance ?? []);
  const earned = $derived(now.earned?.length ? flow(now.earned, 1) : "");
  const spent = $derived(now.spent?.length ? flow(now.spent, -1) : "");
  const unpaid = $derived(now["bills-unpaid"] ?? []);
  const paid = $derived(now["bills-paid"] ?? []);
  const left = $derived(now["left-to-spend"] ?? []);
  const worth = $derived(now["net-worth"] ?? []);

  const leftState = $derived.by(() => {
    if (left.some((e) => e.noBudgets)) {
      return "none";
    }
    const sum = display.total(left);
    return (sum ? sum.amount > 0 : left.some((e) => e.amount > 0))
      ? "ok"
      : "over";
  });
  const perDay = $derived.by(() => {
    const sum = display.total(left);
    if (!sum) {
      return left[0]?.sub ?? "";
    }
    const from = today() < period.start ? period.start : today();
    const days = daysBetween(from, period.end) + 1;
    if (leftState === "none" || days < 1) {
      return "";
    }
    const amount = formatMoney({ ...sum, amount: sum.amount / days });
    return `${sum.converted ? "≈" : ""}${amount}`;
  });
  const leftTitle = $derived(
    leftState === "none"
      ? (left.find((e) => e.noBudgets)?.title.replace(CURRENCY_SUFFIX, "") ??
          "Spent")
      : "Left to spend"
  );
  const leftColor = $derived(
    {
      none: "var(--ff-transfer)",
      ok: "var(--ff-income)",
      over: "var(--ff-expense)",
    }[leftState]
  );
  const paidShare = $derived.by(() => {
    const done = paid.length ? display.total(absolute(paid))?.amount : 0;
    const due = unpaid.length ? display.total(absolute(unpaid))?.amount : 0;
    if (display.active && done !== undefined && due !== undefined) {
      return { paid: done, total: done + due };
    }
    const code = unpaid[0]?.code ?? paid[0]?.code;
    const p = Math.abs(paid.find((e) => e.code === code)?.amount ?? 0);
    const u = Math.abs(unpaid.find((e) => e.code === code)?.amount ?? 0);
    return { paid: p, total: p + u };
  });
</script>

{#snippet values(
  list: SummaryEntry[],
  abs = false
)}
  {@const [main, ...rest] = lines(list, abs)}
  {#if main === undefined}
    <div class="font-semibold text-[18px] text-cladd-fg-softer sm:text-[22px]">
      0
    </div>
  {:else}
    <div
      class="wrap-anywhere font-semibold text-[18px] text-cladd-fg tracking-[-0.02em] sm:text-[22px]"
    >
      {main}
    </div>
    {#if rest.length > 0}
      <div class="num flex flex-wrap gap-x-2 text-[12px] text-cladd-fg-soft">
        {#each rest as text (text)}
          <span>{text}</span>
        {/each}
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet change(
  delta: Delta | null
)}
  {#if delta}
    <div
      class="hidden items-center gap-1 text-[12px] sm:flex {delta.good
        ? "text-income"
        : "text-expense"}"
    >
      {#if delta.up}
        <ArrowUp class="size-3.5 shrink-0" />
      {:else}
        <ArrowDown class="size-3.5 shrink-0" />
      {/if}
      <span
        ><span class="num">{delta.text}</span>
        <span class="text-cladd-fg-soft">than {prevName}</span></span
      >
    </div>
  {/if}
{/snippet}

{#snippet box(
  title: string,
  href: string,
  icon: Component,
  color: string,
  body: Snippet
)}
  {@const Icon = icon}
  <section
    class="cladd-surface cladd-outline flex min-w-0 gap-3 rounded-cladd-lg p-3 {current.isPlaceholderData
      ? "opacity-60"
      : ""}"
  >
    <span
      class="hidden size-10 shrink-0 place-items-center rounded-cladd-md text-white sm:grid dark:text-black/75"
      style:background={color}
    >
      <Icon class="size-5" />
    </span>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <a
        class="truncate text-[12px] text-cladd-fg-soft hover:text-cladd-fg hover:underline"
        {href}
        >{title}</a
      >
      {@render body()}
    </div>
  </section>
{/snippet}

{#snippet inOut()}
  {@render values(balance)}
  {#if earned || spent}
    <div class="num flex flex-wrap gap-x-2 text-[12px]">
      {#if earned}
        <span class="text-income">{earned}</span>
      {/if}
      {#if spent}
        <span class="text-expense">{spent}</span>
      {/if}
    </div>
  {/if}
  {@render change(compare("balance", ["more", "less"]))}
{/snippet}

{#snippet bills()}
  {@render values(unpaid, true)}
  {#if paidShare.total > 0}
    <Meter
      max={paidShare.total}
      segments={[{ color: "var(--ff-series-3)", value: paidShare.paid }]}
    />
  {/if}
  <div class="flex flex-wrap gap-x-2 text-[12px] text-cladd-fg-soft">
    <span>Paid:</span>
    {#each lines(paid, true) as text (text)}
      <span class="num">{text}</span>
    {:else}
      <span class="num">0</span>
    {/each}
  </div>
{/snippet}

{#snippet leftToSpend()}
  {@render values(left)}
  {#if perDay}
    <div class="text-[12px] text-cladd-fg-soft">
      {leftState === "none" ? "" : "Per day: "}<span class="num">{perDay}</span>
    </div>
  {/if}
  {@render change(compare("left-to-spend", ["more", "less"]))}
{/snippet}

{#snippet netWorth()}
  {@render values(worth)}
  {@render change(compare("net-worth", ["more", "less"]))}
{/snippet}

<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
  {@render box(
    "In + out this period",
    reportPath({
      accounts: [ALL_ASSETS],
      end: period.end,
      items: [],
      start: period.start,
      type: "default",
    }),
    Scale,
    "var(--ff-transfer)",
    inOut
  )}
  {@render box(
    "Subscriptions to pay",
    "/subscriptions",
    CalendarClock,
    "var(--ff-series-3)",
    bills
  )}
  {@render box(leftTitle, "/budgets", Wallet, leftColor, leftToSpend)}
  {@render box(
    "Net worth",
    reportPath({
      accounts: [ALL_ASSETS],
      end: `${year}-12-31`,
      items: [],
      start: `${year}-01-01`,
      type: "default",
    }),
    ChartLine,
    "var(--ff-brand)",
    netWorth
  )}
</div>
