<script lang="ts" module>
  export const ROW = Symbol("report-row");
</script>

<script lang="ts">
  import { type Snippet, setContext } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { useReport } from "#lib/reports/report.svelte.js";
  import DrillPanel from "./DrillPanel.svelte";

  let {
    children,
    class: className = "",
  }: { children: Snippet; class?: string } = $props();

  const boxes = new SvelteSet<string>();
  setContext(ROW, boxes);

  const report = useReport();
  const drill = $derived(
    report.drill && boxes.has(report.drill.box) ? report.drill : null
  );
</script>

<div class="grid gap-4 {className}">
  {@render children()}
</div>
{#if drill}
  <div
    class="cladd-surface cladd-outline scroll-mt-12 overflow-hidden rounded-cladd-lg"
    id="drill-{drill.box}"
  >
    <DrillPanel {drill} />
  </div>
{/if}
