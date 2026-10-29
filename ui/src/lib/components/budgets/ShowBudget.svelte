<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Budget, BudgetLimit, One } from "#lib/api/types.js";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import type { Lane, StackRow } from "#lib/components/charts/chart.js";
  import Dimension from "#lib/components/dimension/Dimension.svelte";
  import LimitLine from "#lib/components/dimension/LimitLine.svelte";
  import LimitStrip from "#lib/components/dimension/LimitStrip.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { DimensionModel } from "#lib/dimension/model.svelte.js";
  import { budgetSpec } from "#lib/dimension/spec.js";
  import {
    limitFacts,
    limitsIn,
    stripsOf,
    withLimits,
  } from "#lib/dimension/stats.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { longMonth } from "#lib/reports/board.js";
  import { goto } from "$app/navigation";
  import { limitRange } from "./data.js";

  let { id, limitId }: { id: string; limitId?: string } = $props();

  const budget = createQuery(() => ({
    queryFn: () => api<One<Budget>>(`/v1/budgets/${id}`),
    queryKey: ["budget", id],
  }));
  const limits = createQuery(() => ({
    queryFn: () => all<BudgetLimit>(`/v1/budgets/${id}/limits`),
    queryKey: ["budget-limits", id],
  }));
  const model = new DimensionModel(() => ({ spec: budgetSpec(id) }));

  const name = $derived(budget.data?.data.attributes.name ?? "");
  const list = $derived(limits.data ?? []);
  const limit = $derived(list.find((l) => l.id === limitId));
  const shown = $derived(limitsIn(list, model.into));
  const facts = $derived(
    model.range
      ? limitFacts(shown, model.main, model.range, model.now).sort(
          (a, b) =>
            Number(b.code === limit?.attributes.currency_code) -
            Number(a.code === limit?.attributes.currency_code)
        )
      : []
  );
  const strips = $derived(stripsOf(shown, model.main, model.months));

  $effect(() => {
    if (limit) {
      const range = limitRange(limit);
      untrack(() => period.set(range));
    }
  });
  $effect(() => {
    const { start, end } = period;
    untrack(() => {
      const range = limit && limitRange(limit);
      if (range && (range.start !== start || range.end !== end)) {
        setTimeout(() =>
          goto(`/budgets/show/${id}?start=${start}&end=${end}`, {
            replace: true,
            reset: false,
          })
        );
      }
    });
  });

  async function remove() {
    await api(`/v1/budgets/${id}`, { method: "DELETE" });
    await invalidate();
    await goto("/budgets");
  }

  useKeys(() => [
    {
      group: "Budget",
      keys: "E",
      label: "Edit budget",
      run: () => goto(`/budgets/edit/${id}`),
    },
  ]);
</script>

<PageHeader
  crumbs={[{ href: "/budgets", label: "Budgets" }, { label: name || "Budget" }]}
  subtitle={period.label}
  title={name || "Budget"}
>
  {#snippet actions()}
    <Button
      href="/budgets/edit/{id}"
      size="sm"
      title="Shift+E"
      variant="outline"
      >Edit</Button
    >
    <ConfirmButton onconfirm={remove}>Delete</ConfirmButton>
  {/snippet}
</PageHeader>

{#snippet header(
  lane: Lane,
  row: StackRow | undefined
)}
  <span class="w-10 shrink-0 font-semibold text-cladd-fg">{lane.label}</span>
  {#if row}
    <span class="text-cladd-fg-soft">{longMonth(row.key)}</span>
    <span class="num font-semibold text-cladd-fg"
      >{lane.format((row.values.spent ?? 0) + (row.values.over ?? 0))}</span
    >
    {#if row.values.left !== undefined}
      <span class="text-cladd-fg-soft"
        >of
        <span class="num"
          >{lane.format((row.values.spent ?? 0) + row.values.left)}</span
        >
        limit</span
      >
    {/if}
  {/if}
  {#if lane.typical}
    <span class="flex items-center gap-1.5 text-cladd-fg-soft">
      <span
        aria-hidden="true"
        class="w-3 border-cladd-fg-soft border-t-[1.5px] border-dotted"
      ></span>
      typical
      <span class="num">{lane.format(lane.typical)}</span>
    </span>
  {/if}
{/snippet}

<Dimension
  {header}
  {model}
  noun="purchases"
  shape={(lanes) => withLimits(lanes, shown)}
>
  {#snippet extra()}
    {#if !limits.isPending}
      <LimitLine {facts} />
    {/if}
  {/snippet}
  {#snippet below()}
    <LimitStrip budgetId={id} cursor={model.focus} {strips} />
  {/snippet}
</Dimension>
