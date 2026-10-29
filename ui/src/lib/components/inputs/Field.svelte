<script lang="ts">
  import type { Snippet } from "svelte";
  import { prettyKeys } from "#lib/keys.svelte.js";

  let {
    label,
    for: target,
    error: message = "",
    keys = "",
    note,
    children,
    class: className = "",
  }: {
    label: string;
    for?: string;
    error?: string;
    keys?: string;
    note?: Snippet;
    children: Snippet;
    class?: string;
  } = $props();
</script>

<div class="flex min-w-0 flex-col gap-1 {className}">
  <div class="flex items-baseline justify-between gap-2">
    <label class="text-[12px] text-cladd-fg-soft" for={target}>{label}</label>
    {#if keys}
      <span class="kbd hidden lg:inline-flex"
        >{prettyKeys(keys).join(" ")}</span
      >
    {/if}
  </div>
  {@render children()}
  {#if message}
    <p class="text-[12px] text-expense" role="alert">{message}</p>
  {/if}
  {@render note?.()}
</div>
