<script lang="ts">
  import type { Split } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import BarChart from "#lib/components/charts/BarChart.svelte";
  import { type Bar, tones } from "#lib/components/charts/chart.js";
  import {
    byCurrency,
    currency,
    money,
  } from "#lib/components/dashboard/data.js";
  import { display } from "#lib/money/display.svelte.js";
  import type { Group } from "#lib/transactions/split.js";

  const TOP = 6;

  let {
    title,
    groups,
    kind,
    by,
  }: {
    title: string;
    groups: Group[];
    kind: "withdrawal" | "deposit";
    by: "category" | "budget";
  } = $props();

  function pick(split: Split): [string, string] {
    if (by === "budget") {
      return split.budget_id
        ? [split.budget_name ?? "", `/budgets/show/${split.budget_id}`]
        : ["(no budget)", "/budgets/list/no-budget"];
    }
    return split.category_id
      ? [split.category_name ?? "", `/categories/show/${split.category_id}`]
      : ["(no category)", "/categories/list/no-category"];
  }

  const splits = $derived(
    groups
      .flatMap((g) => g.attributes.transactions)
      .filter((s) => s.type === kind)
  );

  const merged = $derived(
    display.active &&
      splits.every((s) => display.rate(s.currency_code) !== null)
  );
  const buckets = $derived<[string, Split[]][]>(
    merged
      ? [[display.code, splits]]
      : byCurrency(splits, (s) => s.currency_code ?? "")
  );
  const approx = $derived(
    merged && splits.some((s) => s.currency_code !== display.code)
  );

  const sections = $derived(
    buckets.map(([code, list]) => {
      const sums = new Map<string, Bar>();
      for (const split of list) {
        const [label, href] = pick(split);
        const bar = sums.get(label) ?? { href, key: label, label, value: 0 };
        const value = Number(split.amount);
        bar.value += merged
          ? (display.convert(value, split.currency_code) ?? 0)
          : value;
        sums.set(label, bar);
      }
      const sorted = [...sums.values()].sort((a, b) => b.value - a.value);
      const rest = sorted.slice(TOP);
      const bars =
        rest.length > 1
          ? [
              ...sorted.slice(0, TOP),
              {
                key: "other",
                label: `Other (${rest.length})`,
                value: rest.reduce((sum, b) => sum + b.value, 0),
              },
            ]
          : sorted;
      const format = money(currency(code));
      return {
        bars,
        code,
        format: approx ? (value: number) => `≈${format(value)}` : format,
      };
    })
  );
</script>

<Box {title}>
  {#if sections.length === 0}
    <p class="py-4 text-center text-cladd-fg-soft">
      {kind === "withdrawal" ? "No expenses" : "No income"}
      in this period.
    </p>
  {:else}
    <div class="flex flex-col gap-3">
      {#each sections as section (section.code)}
        <div class="flex flex-col gap-1">
          {#if sections.length > 1}
            <span
              class="font-semibold text-[11px] text-cladd-fg-soft tracking-wide"
              >{section.code}</span
            >
          {/if}
          <BarChart
            bars={section.bars}
            color={kind === "withdrawal" ? tones.expense : tones.income}
            format={section.format}
            label="{title} in {section.code}"
            labelWidth="minmax(5rem, 9rem)"
            orientation="horizontal"
          />
        </div>
      {/each}
    </div>
  {/if}
</Box>
