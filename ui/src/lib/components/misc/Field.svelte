<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    for: target,
    problem,
    help,
    children,
  }: {
    label: string;
    for?: string;
    problem?: string;
    help?: string;
    children: Snippet;
  } = $props();
</script>

<div class="@container">
  <div class="grid gap-1 @lg:grid-cols-[11rem_minmax(0,1fr)] @lg:gap-3">
    <label
      class="font-medium text-[13px] text-cladd-fg @lg:pt-1.5 @lg:text-right"
      for={target}
      >{label}</label
    >
    <div class="flex min-w-0 flex-col gap-1">
      {@render children()}
      {#if problem}
        <p class="text-[12px] text-expense">{problem}</p>
      {:else if help}
        <p class="text-[12px] text-cladd-fg-soft">{help}</p>
      {/if}
    </div>
  </div>
</div>
