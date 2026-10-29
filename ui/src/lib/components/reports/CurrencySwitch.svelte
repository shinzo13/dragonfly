<script lang="ts">
  import {
    modeLabel,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";

  const report = useReport();
</script>

{#if report.available.length > 1}
  <div class="flex items-center gap-3 text-[12px]">
    {#each report.available as mode (mode)}
      <button
        aria-pressed={report.mode === mode}
        class={report.mode === mode
          ? "font-semibold text-cladd-fg"
          : "text-brand hover:underline dark:text-[var(--ff-series-1)]"}
        onclick={() => navigate({ cur: mode })}
        type="button"
      >
        {modeLabel(mode)}
      </button>
    {/each}
  </div>
{/if}
