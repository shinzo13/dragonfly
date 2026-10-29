<script lang="ts">
  import type { Split } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import Money from "#lib/components/Money.svelte";
  import { display } from "#lib/money/display.svelte.js";
  import {
    debtMove,
    type Group,
    type Signed,
    sumByCurrency,
  } from "#lib/transactions/split.js";

  const TOP = 5;
  const TOTALS = [
    ["Spent", "auto", (s: Split) => s.type === "withdrawal" && !debtMove(s)],
    ["Earned", "auto", (s: Split) => s.type === "deposit" && !debtMove(s)],
    ["Transferred", "transfer", (s: Split) => s.type === "transfer"],
    ["From debts", "transfer", (s: Split) => debtMove(s) === "in"],
    ["To debts", "transfer", (s: Split) => debtMove(s) === "out"],
  ] as const;

  interface Entry {
    href?: string;
    name: string;
    sums: Signed[];
  }

  let {
    groups,
    type,
    loading = false,
  }: { groups: Group[]; type: string; loading?: boolean } = $props();

  const splits = $derived(groups.flatMap((g) => g.attributes.transactions));
  const flows = $derived(splits.filter((s) => !debtMove(s)));

  const totals = $derived(
    TOTALS.map(([label, tone, test]) => ({
      label,
      sums: sumByCurrency(splits.filter(test)),
      tone,
    })).filter((row) => row.sums.length > 0)
  );

  const toneOf = (sums: Signed[]) =>
    sums.every((sum) => sum.tone === "transfer") ? "transfer" : "auto";

  const size = (entry: Entry) =>
    Math.abs(
      display.total(entry.sums)?.amount ??
        Math.max(...entry.sums.map((sum) => Math.abs(sum.amount)))
    );

  function aggregate(
    list: Split[],
    pick: (split: Split) => [string, string | undefined]
  ): { entries: Entry[]; more: number } {
    const map = new Map<string, { href?: string; splits: Split[] }>();
    for (const split of list) {
      const [name, href] = pick(split);
      const entry = map.get(name) ?? { href, splits: [] };
      entry.splits.push(split);
      map.set(name, entry);
    }
    const sorted = [...map]
      .map(([name, entry]) => ({
        href: entry.href,
        name,
        sums: sumByCurrency(entry.splits).sort(
          (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
        ),
      }))
      .sort((a, b) => size(b) - size(a));
    return { entries: sorted.slice(0, TOP), more: sorted.length - TOP };
  }

  const blocks = $derived([
    {
      title: "Categories",
      ...aggregate(flows, (s) =>
        s.category_id
          ? [s.category_name ?? "", `/categories/show/${s.category_id}`]
          : ["(no category)", undefined]
      ),
    },
    type === "withdrawal"
      ? {
          title: "Budgets",
          ...aggregate(flows, (s) =>
            s.budget_id
              ? [s.budget_name ?? "", `/budgets/show/${s.budget_id}`]
              : ["(no budget)", undefined]
          ),
        }
      : {
          title: "Source accounts",
          ...aggregate(flows, (s) => [
            s.source_name ?? "(cash)",
            s.source_id ? `/accounts/show/${s.source_id}` : undefined,
          ]),
        },
    {
      title: "Destination accounts",
      ...aggregate(flows, (s) => [
        s.destination_name ?? "(cash)",
        s.destination_id ? `/accounts/show/${s.destination_id}` : undefined,
      ]),
    },
  ]);
</script>

<div class="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
  <Box body="px-3 py-2" title="Overview">
    {#if loading && groups.length === 0}
      <p class="text-cladd-fg-soft">Loading...</p>
    {:else}
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt class="text-cladd-fg-soft">Transactions</dt>
        <dd class="num text-right">{groups.length}</dd>
        {#each totals as row (row.label)}
          <dt class="text-cladd-fg-soft">{row.label}</dt>
          <dd class="flex flex-col items-end">
            <Money parts={row.sums} tone={row.tone} />
          </dd>
        {/each}
      </dl>
    {/if}
  </Box>
  {#each blocks as block (block.title)}
    <Box body="py-1" class="max-md:hidden" title={block.title}>
      <ul>
        {#each block.entries as entry (entry.name)}
          <li
            class="flex min-h-6 items-start justify-between gap-3 px-3 py-0.5"
          >
            {#if entry.href}
              <a class="truncate hover:underline" href={entry.href}
                >{entry.name}</a
              >
            {:else}
              <span class="truncate text-cladd-fg-soft">{entry.name}</span>
            {/if}
            <span class="flex flex-col items-end">
              <Money parts={entry.sums} tone={toneOf(entry.sums)} />
            </span>
          </li>
        {:else}
          <li class="px-3 py-1 text-cladd-fg-soft">
            {loading ? "Loading..." : "Nothing in this period."}
          </li>
        {/each}
        {#if block.more > 0}
          <li class="px-3 text-[12px] text-cladd-fg-softer">
            and {block.more} more
          </li>
        {/if}
      </ul>
    </Box>
  {/each}
</div>
