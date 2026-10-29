<script lang="ts">
  import { fmt, type LimitFact } from "#lib/dimension/stats.js";
  import { percent } from "#lib/format.js";

  let { facts }: { facts: LimitFact[] } = $props();
</script>

<div class="-mt-1 flex flex-col gap-0.5 pb-3 text-[13px] text-cladd-fg-soft">
  {#each facts as fact (fact.id)}
    {@const expected =
      fact.day === null ? null : (fact.amount * fact.day) / fact.days}
    {@const left = fact.amount - fact.spent}
    <p class="flex flex-wrap items-baseline gap-x-1.5">
      <span
        >limit
        <span class="num font-semibold text-cladd-fg"
          >{fmt(fact.code, fact.amount, 0)}</span
        ></span
      >
      <span
        >· spent
        <span class="num text-cladd-fg"
          >{percent(fact.amount > 0 ? fact.spent / fact.amount : 0)}</span
        ></span
      >
      {#if fact.day !== null && expected !== null}
        <span>· day {fact.day} of {fact.days} →</span>
        {#if fact.spent > expected}
          <span class="font-semibold text-expense"
            >{fmt(fact.code, fact.spent - expected, 0)}
            over pace</span
          >
        {:else}
          <span class="font-semibold text-income">under pace</span>
        {/if}
      {/if}
      {#if left >= 0}
        <span
          >·
          <span class="num text-cladd-fg">{fmt(fact.code, left, 0)}</span>
          left</span
        >
      {:else}
        <span
          >·
          <span class="num font-semibold text-expense"
            >{fmt(fact.code, -left, 0)}</span
          >
          overspent</span
        >
      {/if}
    </p>
  {:else}
    <p>no limit for this period</p>
  {/each}
</div>
