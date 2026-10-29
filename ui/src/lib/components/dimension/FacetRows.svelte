<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import { untrack } from "svelte";
  import Sparkline from "#lib/components/charts/Sparkline.svelte";
  import { type FacetRow, fmt } from "#lib/dimension/stats.js";
  import { percent } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";

  const GROUP = "Inside";

  let {
    rows,
    loading,
    active,
    current,
    marker,
    label,
    onnarrow,
    onleave,
  }: {
    rows: FacetRow[];
    loading: boolean;
    active: boolean;
    current: string | null;
    marker: number;
    label: string;
    onnarrow: (row: FacetRow) => void;
    onleave: () => void;
  } = $props();

  function tint(i: number, row: FacetRow) {
    if (active && nav.cursor === i) {
      return "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]";
    }
    return row.key === current ? "bg-row-selected" : "hover:bg-row-hover";
  }

  const top = $derived(Math.max(...rows.map((row) => row.share), 0) || 1);

  const nav: ListNav<FacetRow> = new ListNav<FacetRow>({
    extra: () => [
      {
        group: GROUP,
        keys: "Enter",
        label: "Narrow the transactions to this row",
        run: () => nav.current && onnarrow(nav.current),
      },
      {
        group: GROUP,
        keys: "o",
        label: "Open the page of this row",
        run: () => nav.current?.href && goto(nav.current.href),
      },
      {
        group: GROUP,
        keys: "Escape",
        label: "Back to the transactions",
        run: onleave,
      },
    ],
    id: "facet",
    items: () => rows,
    key: (row) => row.key,
  });

  useKeys(() => (active ? nav.bindings() : []));

  $effect(() => {
    if (active) {
      untrack(() =>
        nav.move(
          Math.max(
            0,
            rows.findIndex((row) => row.key === current)
          )
        )
      );
    }
  });
</script>

{#if rows.length === 0 && !loading}
  <p class="px-3 py-6 text-center text-[12px] text-cladd-fg-soft">
    Nothing in this period.
  </p>
{:else if rows.length > 0}
  <ul
    aria-label={label}
    class="grid min-h-0 flex-1 auto-rows-min grid-cols-[minmax(0,1fr)_auto_auto_auto] overflow-y-auto py-1 text-[12px] sm:grid-cols-[minmax(6rem,1fr)_minmax(2rem,7rem)_auto_auto_auto_auto]"
  >
    {#each rows as row, i (row.key)}
      <li
        class="col-span-full grid h-7 grid-cols-subgrid items-center gap-x-2.5 px-3 {tint(
          i,
          row
        )}"
        id={nav.rowId(i)}
      >
        <button
          class="truncate text-left text-cladd-fg hover:underline"
          onclick={() => onnarrow(row)}
          title={row.label}
          type="button"
        >
          {row.label}
        </button>
        <span class="relative h-2.5 max-sm:hidden">
          <span
            class="absolute inset-y-0 left-0 rounded-r-sm bg-brand"
            style:width="max(1px, {(row.share / top) * 100}%)"
          ></span>
        </span>
        <span class="num truncate text-right text-cladd-fg">
          {row.sums.map((sum) => fmt(sum.code, sum.amount, 0)).join(" + ")}
        </span>
        <span class="num w-9 text-right text-cladd-fg-soft"
          >{percent(row.share)}</span
        >
        <span class="max-sm:hidden">
          <Sparkline
            color="var(--ff-brand)"
            height={18}
            {marker}
            values={row.spark}
            width={56}
          />
        </span>
        {#if row.href}
          <a
            aria-label="Open {row.label}"
            class="text-cladd-fg-softer hover:text-cladd-fg"
            href={row.href}
          >
            <ArrowUpRight class="size-3.5" />
          </a>
        {:else}
          <span></span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
