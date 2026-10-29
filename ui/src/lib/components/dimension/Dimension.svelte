<script lang="ts">
  import type { Snippet } from "svelte";
  import Box from "#lib/components/Box.svelte";
  import { setParam } from "#lib/components/categories/url.js";
  import {
    type Lane,
    type StackRow,
    tones,
  } from "#lib/components/charts/chart.js";
  import Lanes from "#lib/components/charts/Lanes.svelte";
  import type { Range } from "#lib/dates.js";
  import type { DimensionModel } from "#lib/dimension/model.svelte.js";
  import type { Facet } from "#lib/dimension/spec.js";
  import { lanesOf } from "#lib/dimension/stats.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { longMonth, monthRange } from "#lib/reports/board.js";
  import { page } from "$app/state";
  import Headline from "./Headline.svelte";
  import Inside from "./Inside.svelte";
  import Ledger from "./Ledger.svelte";

  const LANE_HEIGHTS = [180, 112, 88];

  let {
    model,
    noun,
    accountId,
    shape = (list: Lane[]) => list,
    onmonth = (month: Range) => period.set(month),
    lead,
    extra,
    below,
    header,
  }: {
    model: DimensionModel;
    noun: string;
    accountId?: string;
    shape?: (lanes: Lane[]) => Lane[];
    onmonth?: (range: Range) => void;
    lead?: Snippet;
    extra?: Snippet;
    below?: Snippet;
    header?: Snippet<[Lane, StackRow | undefined]>;
  } = $props();

  const height = $derived(
    LANE_HEIGHTS[Math.min(model.codes.length, LANE_HEIGHTS.length) - 1] ?? 88
  );
  const lanes = $derived(
    shape(
      lanesOf(
        model.flows,
        model.months,
        model.codes,
        model.dir,
        model.norms,
        height
      )
    )
  );

  const facets = $derived(model.spec.facets);
  const facet = $derived(
    facets.find((f) => f.id === page.url.searchParams.get("facet")) ?? facets[0]
  );
  const only = $derived.by(() => {
    const value = page.url.searchParams.get("only") ?? "";
    const cut = value.indexOf(":");
    const found = facets.find((f) => f.id === value.slice(0, cut));
    return found && cut > 0
      ? { facet: found, key: value.slice(cut + 1) }
      : null;
  });
  const narrowed = $derived.by(() => {
    if (!only) {
      return null;
    }
    const ids = new Set<string>();
    let label = only.key;
    for (const flow of model.periodFlows) {
      const key = only.facet.of(flow).find((k) => k.key === only.key);
      if (key) {
        ids.add(flow.group);
        ({ label } = key);
      }
    }
    return { groups: model.groups.filter((g) => ids.has(g.id)), label };
  });

  const pick = (f: Facet) =>
    setParam("facet", f.id === facets[0]?.id ? "" : f.id);
  const clear = () => setParam("only", "");

  useKeys(() =>
    only
      ? [
          {
            group: "Inside",
            keys: "Escape",
            label: "Show all transactions again",
            run: clear,
          },
        ]
      : []
  );
</script>

<Headline {lead} {model} {noun} />
{@render extra?.()}

<div class="grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
  <Box title={model.everything ? "All months" : "13 months"}>
    {#if lanes.length > 0}
      <Lanes
        cursor={model.focus}
        dotColor={model.dir === -1 ? tones.income : tones.expense}
        dotLabel={model.dir === -1 ? "in" : "out"}
        {header}
        label="Months by currency"
        {lanes}
        moreIsGood={model.dir === 1}
        onselect={(month) => onmonth(monthRange(month))}
        partial={model.partial}
        title={(row) => longMonth(row.key)}
      />
    {:else if !model.loading}
      <p class="py-10 text-center text-[12px] text-cladd-fg-soft">
        No spending or income here in these months.
      </p>
    {/if}
    {@render below?.()}
  </Box>
  <Inside
    class="lg:[contain:size]"
    current={only?.facet.id === facet.id ? only.key : null}
    {facet}
    {model}
    onfacet={pick}
    onnarrow={(f, row) =>
      setParam(
        "only",
        only?.facet.id === f.id && only.key === row.key
          ? ""
          : `${f.id}:${row.key}`
      )}
  />
</div>

<div class="mt-3">
  <Ledger
    {accountId}
    empty={model.everything
      ? "No transactions."
      : "No transactions in this period."}
    groups={model.groups}
    loading={model.loading}
    {narrowed}
    onclear={clear}
  />
</div>
