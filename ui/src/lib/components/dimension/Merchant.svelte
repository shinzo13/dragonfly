<script lang="ts">
  import { daysBetween } from "#lib/dates.js";
  import { DimensionModel } from "#lib/dimension/model.svelte.js";
  import { merchantSpec } from "#lib/dimension/spec.js";
  import { counted, factsOf, fmt } from "#lib/dimension/stats.js";
  import { formatDate, formatNumber } from "#lib/format.js";
  import Dimension from "./Dimension.svelte";

  let { id, everything = false }: { id: string; everything?: boolean } =
    $props();

  const model = new DimensionModel(() => ({
    allTime: true,
    everything,
    spec: merchantSpec(id),
  }));

  const history = $derived(
    factsOf(
      model.main.filter((flow) => flow.date <= model.now),
      model.codes
    )
  );
  const noun = $derived(model.dir === -1 ? "visits" : "payments");
  const every = $derived(
    history.count > 1
      ? daysBetween(history.first, history.last) / (history.count - 1)
      : null
  );
  const bill = $derived(model.main.find((flow) => flow.bill)?.bill ?? null);
</script>

{#snippet lead()}
  {#if !model.loading}
    <p
      class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[14px] text-cladd-fg-soft"
    >
      {#if history.count > 0}
        {#each history.sums as sum, i (sum.code)}
          {#if i > 0}
            <span>+</span>
          {/if}
          <span class="num font-semibold text-[22px] text-cladd-fg"
            >{fmt(sum.code, sum.amount, 0)}</span
          >
        {/each}
        <span>all time · {counted(history.count, noun)}</span>
        {#if history.median}
          <span
            >· median
            <span class="num text-cladd-fg"
              >{fmt(history.median.code, history.median.amount, 0)}</span
            ></span
          >
        {/if}
        {#if every !== null}
          <span
            >· every
            <span class="num text-cladd-fg"
              >{formatNumber(every, every < 10 ? 1 : 0)}</span
            >
            days</span
          >
        {/if}
        <span
          >· last
          <span class="text-cladd-fg"
            >{formatDate(history.last, "short")}</span
          ></span
        >
        {#if bill}
          <span
            >· subscription
            <a
              class="text-brand hover:underline"
              href="/subscriptions/show/{bill.id}"
              >{bill.name}</a
            ></span
          >
        {/if}
      {:else}
        <span class="font-semibold text-[22px] text-cladd-fg"
          >No {noun} yet</span
        >
      {/if}
    </p>
  {/if}
{/snippet}

<Dimension accountId={id} {lead} {model} {noun} />
