<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    id,
    issue,
    children,
  }: {
    label: string;
    id: string;
    issue?: string;
    children: Snippet;
  } = $props();
</script>

<div
  class="grid items-start gap-x-4 gap-y-1 py-1.5 sm:grid-cols-[10rem_minmax(0,1fr)]"
>
  <label class="pt-1 text-[13px] text-cladd-fg-soft" for={id}>{label}</label>
  <div class="flex min-w-0 flex-col gap-1">
    {@render children()}
    {#if issue}
      <span class="text-[12px] text-expense">{issue}</span>
    {/if}
  </div>
</div>
