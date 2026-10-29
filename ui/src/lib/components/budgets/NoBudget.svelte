<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { all } from "#lib/api/lists.js";
  import type { TransactionGroup } from "#lib/api/types.js";
  import PeriodList from "#lib/components/categories/PeriodList.svelte";
  import { windowOf } from "#lib/components/categories/sums.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { formatDate } from "#lib/format.js";
  import { period } from "#lib/period.svelte.js";
  import { periodPath, usePeriodPath } from "./period-path.svelte.js";

  const BASE = "/budgets/list/no-budget";

  let { everything = false }: { everything?: boolean } = $props();

  usePeriodPath(() => BASE);

  const span = $derived(windowOf(period.end, period.view));
  const query = createQuery(() => ({
    enabled: period.ready,
    queryFn: () =>
      all<TransactionGroup>(
        "/v1/budgets/transactions-without-budget",
        everything
          ? { type: "withdrawal" }
          : { end: span.end, start: span.start, type: "withdrawal" }
      ),
    queryKey: everything
      ? ["no-budget", "all"]
      : ["no-budget", span.start, span.end],
  }));

  const title = $derived(
    everything
      ? "All transactions without a budget"
      : `Transactions without a budget between ${formatDate(period.start)} and ${formatDate(period.end)}`
  );
</script>

<PageHeader
  crumbs={[
    { href: "/budgets", label: "Budgets" },
    { label: "Expenses without a budget" },
  ]}
  title="Expenses without a budget"
/>

<PeriodList
  fields={["spent"]}
  groups={query.data ?? []}
  href={(range) => periodPath(BASE, range.start, range.end)}
  keep={(split) => !split.budget_id && split.type === "withdrawal"}
  loading={query.isPending}
  sidebar={!everything}
  {title}
>
  {#snippet links()}
    {#if everything}
      <a class="text-brand hover:underline" href={BASE}
        >Show the current period and overview</a
      >
    {:else}
      <a class="text-brand hover:underline" href="{BASE}/all"
        >Show all transactions without grouping them by date</a
      >
    {/if}
  {/snippet}
</PeriodList>
