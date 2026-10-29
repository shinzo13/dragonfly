<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Split } from "#lib/api/types.js";
  import type { Range } from "#lib/dates.js";
  import { period } from "#lib/period.svelte.js";
  import type { Group } from "#lib/transactions/split.js";
  import GroupsBox from "./GroupsBox.svelte";
  import PeriodSidebar, { type Field } from "./PeriodSidebar.svelte";
  import { byPeriod, periodRanges, rows, SIDEBAR_PERIODS } from "./sums.js";

  let {
    groups,
    keep,
    title,
    href,
    sidebar = true,
    loading = false,
    fields,
    links,
  }: {
    groups: Group[];
    keep: (split: Split) => boolean;
    title: string;
    href: (range: Range) => string;
    sidebar?: boolean;
    loading?: boolean;
    fields?: Field[];
    links?: Snippet;
  } = $props();

  const own = $derived(rows(groups, keep));
  const visible = $derived.by(() => {
    if (!sidebar) {
      return groups;
    }
    const ids = new Set(
      own
        .filter((r) => {
          const day = r.split.date.slice(0, 10);
          return day >= period.start && day <= period.end;
        })
        .map((r) => r.group.id)
    );
    return groups.filter((g) => ids.has(g.id));
  });
  const periods = $derived(
    byPeriod(own, periodRanges(period.end, period.view, SIDEBAR_PERIODS))
  );
</script>

<div
  class="grid items-start gap-4 {sidebar
    ? "2xl:grid-cols-[minmax(0,1fr)_15rem]"
    : ""}"
>
  <GroupsBox groups={visible} {links} {loading} {title} />
  {#if sidebar}
    <PeriodSidebar {fields} {href} {periods} />
  {/if}
</div>
