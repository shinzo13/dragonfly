<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import type { SvelteSet } from "svelte/reactivity";
  import Box from "#lib/components/Box.svelte";
  import { useReport } from "#lib/reports/report.svelte.js";
  import DrillPanel from "./DrillPanel.svelte";
  import { ROW } from "./ReportRow.svelte";

  let {
    id,
    title,
    loading = false,
    empty = false,
    emptyText = "Nothing in this period.",
    tools,
    footer,
    children,
    body = "p-0",
    class: className = "",
  }: {
    id: string;
    title: string;
    loading?: boolean;
    empty?: boolean;
    emptyText?: string;
    tools?: Snippet;
    footer?: Snippet;
    children: Snippet;
    body?: string;
    class?: string;
  } = $props();

  const report = useReport();
  const row = getContext<SvelteSet<string> | undefined>(ROW);
  $effect(() => {
    row?.add(id);
    return () => row?.delete(id);
  });
</script>

<Box {body} class={className} {footer} {title} {tools}>
  <div class="scroll-mt-12" {id}>
    {#if loading}
      <p class="px-3 py-3 text-cladd-fg-soft">Loading</p>
    {:else if empty}
      <p class="px-3 py-3 text-cladd-fg-soft">{emptyText}</p>
    {:else}
      {@render children()}
    {/if}
    {#if !row && report.drill?.box === id && !loading}
      <DrillPanel drill={report.drill} />
    {/if}
  </div>
</Box>
