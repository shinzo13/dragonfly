<script lang="ts">
  import type { Snippet } from "svelte";
  import { daysBetween } from "#lib/dates.js";
  import type { DimensionModel } from "#lib/dimension/model.svelte.js";
  import { counted, fmt, type Money } from "#lib/dimension/stats.js";
  import { formatDate, formatNumber } from "#lib/format.js";
  import { period } from "#lib/period.svelte.js";
  import { monthOf } from "#lib/reports/board.js";
  import { isApprox } from "#lib/reports/display.js";
  import { versusText } from "#lib/reports/typical.js";

  const WEEK = 7;
  const SAME = 0.03;

  let {
    model,
    noun,
    lead,
  }: { model: DimensionModel; noun: string; lead?: Snippet } = $props();

  const facts = $derived(model.facts);
  const when = $derived.by(() => {
    if (!model.range) {
      return "all time";
    }
    if (model.focus === monthOf(model.now) && period.isCurrent) {
      return "this month";
    }
    return `in ${period.label}`;
  });
  const days = $derived.by(() => {
    const start = model.range?.start ?? model.history.first;
    const end =
      model.range && model.range.end < model.now ? model.range.end : model.now;
    return start ? daysBetween(start, end) + 1 : 0;
  });
  const perWeek = $derived(days >= WEEK ? (facts.count * WEEK) / days : null);
  const main = $derived(model.norms[0]);
  const typicals = $derived(model.norms.filter((n) => n.typical > 0));
  const active = $derived(
    model.typicalMonths.filter((month) =>
      model.main.some((flow) => monthOf(flow.date) === month)
    ).length
  );
  const good = $derived(model.dir === 1);

  function tone(ratio: number | null) {
    if (ratio === null || Math.abs(ratio) < SAME) {
      return "text-cladd-fg-soft";
    }
    return ratio > 0 === good ? "text-income" : "text-expense";
  }
</script>

{#snippet amounts(
  sums: Money[],
  big: boolean
)}
  {#each sums as sum, i (sum.code)}
    {#if i > 0}
      <span class="text-cladd-fg-soft">+</span>
    {/if}
    <span class="num font-semibold text-cladd-fg {big ? "text-[22px]" : ""}"
      >{fmt(sum.code, sum.amount, 0)}</span
    >
  {/each}
{/snippet}

<div class="flex flex-col gap-1 pb-3">
  {#if lead}
    {@render lead()}
  {:else if !model.loading}
    <p
      class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[14px] text-cladd-fg-soft"
    >
      {#if facts.count > 0}
        {@render amounts(facts.sums, true)}
        <span>{when}</span>
        <span>· {counted(facts.count, noun)}</span>
        {#if facts.median}
          <span
            >· median
            <span class="num text-cladd-fg"
              >{fmt(facts.median.code, facts.median.amount, 0)}</span
            ></span
          >
        {/if}
        {#if perWeek !== null}
          <span
            >·
            <span class="num text-cladd-fg"
              >{formatNumber(perWeek, perWeek < 10 ? 1 : 0)}</span
            >
            per week</span
          >
        {/if}
      {:else}
        <span class="font-semibold text-[22px] text-cladd-fg"
          >Nothing {when}</span
        >
        {#if model.history.last}
          <span>· last {formatDate(model.history.last)}</span>
        {/if}
      {/if}
    </p>
  {/if}
  {#if !model.loading && main}
    <p
      class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px] text-cladd-fg-soft"
    >
      {#if lead}
        {#if facts.count > 0}
          {@render amounts(facts.sums, false)}
          <span>{when} ·</span>
        {:else}
          <span>nothing {when} ·</span>
        {/if}
      {/if}
      {#if typicals.length > 0}
        <span>typical month</span>
        {@render amounts(
          typicals.map((n) => ({ amount: n.typical, code: n.code })),
          false
        )}
        {#if main.projected !== null}
          <span
            >· on pace for {isApprox(main.code) ? "" : "≈"}
            <span class="num font-semibold text-cladd-fg"
              >{fmt(main.code, main.projected, 0)}</span
            >,</span
          >
        {:else if main.ratio !== null}
          <span>·</span>
        {/if}
        {#if main.ratio !== null}
          <span class="font-semibold {tone(main.ratio)}"
            >{versusText(main.ratio)}</span
          >
        {/if}
      {:else if model.typicalMonths.length > 0}
        <span
          >in {active} of the last {model.typicalMonths.length}
          {model.typicalMonths.length === 1 ? "month" : "months"}</span
        >
      {/if}
    </p>
  {/if}
</div>
