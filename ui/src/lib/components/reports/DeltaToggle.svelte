<script lang="ts">
  import { navigate, useReport } from "#lib/reports/report.svelte.js";

  let { box }: { box: string } = $props();

  const report = useReport();
  const on = $derived(report.delta === box);
</script>

<button
  aria-pressed={on}
  class="h-6 rounded-cladd-sm px-2 text-[12px] {on
    ? "cladd-cut font-semibold text-cladd-fg"
    : "text-cladd-fg-soft hover:text-cladd-fg"}"
  onclick={() => navigate({ delta: on ? null : box })}
  title={on ? "Show amounts" : "Show change against the previous period"}
  type="button"
>
  {on ? "Amounts" : "Change"}
</button>
