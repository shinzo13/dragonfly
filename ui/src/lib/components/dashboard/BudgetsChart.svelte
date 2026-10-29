<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { lists } from "#lib/api/lists.js";
  import Box from "#lib/components/Box.svelte";
  import {
    type StackKey,
    type StackRow,
    tones,
    wash,
  } from "#lib/components/charts/chart.js";
  import StackedBars from "#lib/components/charts/StackedBars.svelte";
  import { toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import {
    byCurrency,
    type ChartSet,
    type Cur,
    mergeable,
    money,
    setCurrency,
    span,
  } from "./data.js";

  const KEYS: StackKey[] = [
    { color: "var(--ff-series-1)", key: "spent", label: "Spent in budget" },
    {
      color: wash("var(--ff-series-1)", 24),
      key: "left",
      label: "Left to spend",
    },
    { color: tones.expense, key: "over", label: "Overspent" },
  ];

  const chart = createQuery(() => ({
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<ChartSet[]>("/v1/chart/budget/overview", {
        query: span(period.start, period.end),
      }),
    queryKey: ["chart-budgets", period.start, period.end],
  }));
  const budgets = createQuery(() => lists.budgets());

  const ids = $derived(
    new Map((budgets.data ?? []).map((b) => [b.attributes.name, b.id]))
  );

  const sets = $derived(chart.data ?? []);
  const merged = $derived(mergeable(sets.map((s) => s.currency_code)));

  function group(code: string, label: string, cur: Cur, list: ChartSet[]) {
    const format = money(cur);
    const totals = new Map<string, { budgeted: number; spent: number }>();
    for (const s of list) {
      const rate = merged ? (display.rate(s.currency_code) ?? 1) : 1;
      const total = totals.get(s.label) ?? { budgeted: 0, spent: 0 };
      total.budgeted += toNumber(s.entries.budgeted) * rate;
      total.spent += Math.abs(toNumber(s.entries.spent)) * rate;
      totals.set(s.label, total);
    }
    const rows: StackRow[] = [...totals]
      .map(([name, { budgeted, spent }]) => {
        const id = ids.get(name);
        return {
          format,
          href: id ? `/budgets/show/${id}` : undefined,
          key: name,
          label: name,
          note:
            budgeted > 0
              ? `${format(spent)} of ${format(budgeted)}`
              : format(spent),
          values: {
            left: budgeted > 0 ? Math.max(0, budgeted - spent) : 0,
            over: budgeted > 0 ? Math.max(0, spent - budgeted) : 0,
            spent: budgeted > 0 ? Math.min(spent, budgeted) : spent,
          },
        };
      })
      .filter((r) => r.values.spent + r.values.left + r.values.over > 0);
    const limited = [...totals.values()].some((t) => t.budgeted > 0);
    const keys = limited ? KEYS : [{ ...KEYS[0], label: "Spent" }];
    return { code, keys, label, limited, rows };
  }

  const groups = $derived(
    merged
      ? [group(display.code, `≈${display.code}`, display.target, sets)]
      : byCurrency(sets, (s) => s.currency_code).map(([code, list]) =>
          group(code, code, setCurrency(list[0]), list)
        )
  );
  const visible = $derived(groups.filter((g) => g.rows.length > 0));
</script>

<Box href="/budgets" title="Budgets and spending">
  <div
    class="flex flex-col gap-4 transition-opacity {chart.isPlaceholderData
      ? "opacity-60"
      : ""}"
  >
    {#if chart.isPending}
      <div class="h-24"></div>
    {:else if chart.isError}
      <p class="text-expense">{chart.error.message}</p>
    {:else if visible.length === 0}
      <p class="py-6 text-center text-cladd-fg-soft">
        No budgets with a limit or spending in this period. Set an amount for a
        budget on the
        <a
          class="text-brand dark:text-(--ff-series-1) underline"
          href="/budgets"
          >budgets page</a
        >.
      </p>
    {:else}
      {#each visible as group (group.code)}
        <div class="flex flex-col gap-1">
          {#if visible.length > 1 || !group.limited || merged}
            <span class="text-[11px] text-cladd-fg-soft">
              <span class="font-semibold tracking-wide">{group.label}</span>
              {#if !group.limited}
                · spent, no budget amount set in {group.code}
              {/if}
            </span>
          {/if}
          <StackedBars
            keys={group.keys}
            label="Budgets in {group.code}"
            orientation="horizontal"
            rows={group.rows}
          />
        </div>
      {/each}
    {/if}
  </div>
  {#snippet footer()}
    <a
      class="text-brand dark:text-(--ff-series-1) hover:underline"
      href="/budgets"
      >Go to your budgets</a
    >
  {/snippet}
</Box>
