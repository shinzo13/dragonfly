<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import {
    periodPath,
    usePeriodPath,
  } from "#lib/components/budgets/period-path.svelte.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { formatDate } from "#lib/format.js";
  import { period } from "#lib/period.svelte.js";
  import { searchAll } from "./data.js";
  import PeriodList from "./PeriodList.svelte";
  import { windowOf } from "./sums.js";

  const BASE = "/categories/list/no-category";

  let { everything = false }: { everything?: boolean } = $props();

  usePeriodPath(() => BASE);

  const span = $derived(windowOf(period.end, period.view));
  const query = createQuery(() => ({
    enabled: period.ready,
    queryFn: () =>
      searchAll(
        everything
          ? "has_no_category:true"
          : `has_no_category:true date_after:${span.start} date_before:${span.end}`
      ),
    queryKey: everything
      ? ["no-category", "all"]
      : ["no-category", span.start, span.end],
  }));

  const title = $derived(
    everything
      ? "All transactions without a category"
      : `Without category between ${formatDate(period.start)} and ${formatDate(period.end)}`
  );
</script>

<PageHeader
  crumbs={[
    { href: "/categories", label: "Categories" },
    { label: "Without a category" },
  ]}
  title="Transactions without a category"
/>

<PeriodList
  groups={query.data ?? []}
  href={(range) => periodPath(BASE, range.start, range.end)}
  keep={(split) => !split.category_id}
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
