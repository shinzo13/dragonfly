<script lang="ts">
  import Box from "#lib/components/Box.svelte";
  import { percent } from "#lib/format.js";
  import { mergeTops, type Top, topMoney } from "./data.js";

  const CENT = 0.005;

  let { tops, onsort }: { tops: Top[]; onsort: () => void } = $props();

  const shown = $derived(mergeTops(tops));
  const free = $derived(
    shown.some(
      (top) =>
        top.available !== null && Math.abs(top.available - top.budgeted) > CENT
    )
  );
  const columns = $derived(
    [
      free && "Available",
      "Budgeted",
      free && "Left to budget",
      "Left in budgets",
      "Spent",
      "Without a budget",
    ].filter(Boolean) as string[]
  );
</script>

<Box body="px-3 py-3">
  <div
    class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-[3rem_repeat(var(--cols),minmax(0,1fr))] sm:gap-y-2"
    style:--cols={columns.length}
  >
    <span class="max-sm:hidden"></span>
    {#each columns as label (label)}
      <span class="text-[12px] text-cladd-fg-soft max-sm:hidden">{label}</span>
    {/each}
    {#each shown as top, i (top.cur.code)}
      <span
        class="col-span-2 self-center font-semibold text-[13px] text-cladd-fg-soft sm:col-span-1 {i >
        0
          ? "max-sm:mt-1 max-sm:border-cladd-outline max-sm:border-t max-sm:pt-3"
          : ""}"
        >{top.approx ? "≈" : ""}{top.cur.code}</span
      >
      {#if free}
        {@render stat(
          "Available",
          top.available === null ? null : topMoney(top, top.available)
        )}
      {/if}
      {@render stat(
        "Budgeted",
        top.budgeted ? topMoney(top, top.budgeted) : null
      )}
      {#if free}
        {@const unallocated = (top.available ?? 0) - top.budgeted}
        {@render stat(
          "Left to budget",
          top.available === null ? null : topMoney(top, unallocated),
          unallocated < 0 ? "text-expense" : ""
        )}
      {/if}
      {@const left = top.budgeted - top.inBudgets}
      {@render stat(
        "Left in budgets",
        top.budgeted ? topMoney(top, left) : null,
        left < 0 ? "text-expense" : ""
      )}
      {@render stat("Spent", topMoney(top, top.spent))}
      <div class="min-w-0">
        <span class="text-[12px] text-cladd-fg-soft sm:hidden"
          >Without a budget</span
        >
        {#if top.outside > 0}
          <button
            class="block text-left hover:underline"
            onclick={onsort}
            title="Sort them into budgets  t"
            type="button"
          >
            <span
              class="num font-semibold text-[20px] text-brand tracking-[-0.02em] sm:text-[22px]"
              >{topMoney(top, top.outside)}</span
            >
            {#if top.spent > 0}
              <span class="num ml-1 text-[13px] text-cladd-fg-soft"
                >{percent(top.outside / top.spent)}</span
              >
            {/if}
          </button>
        {:else}
          <span
            class="num block font-semibold text-[20px] text-cladd-fg-softer sm:text-[22px]"
            >0</span
          >
        {/if}
      </div>
    {/each}
  </div>
</Box>

{#snippet stat(
  label: string,
  value: string | null,
  tone = ""
)}
  <div class="min-w-0">
    <span class="text-[12px] text-cladd-fg-soft sm:hidden">{label}</span>
    <span
      class="num block font-semibold text-[20px] tracking-[-0.02em] sm:text-[22px] {value ===
      null
        ? "text-cladd-fg-softer"
        : tone || "text-cladd-fg"}"
      >{value ?? "0"}</span
    >
  </div>
{/snippet}
