<script lang="ts">
  import type { Action } from "./action.svelte.js";

  let { action, busy = "Saving" }: { action: Action; busy?: string } = $props();
</script>

{#if action.busy}
  <span class="text-[12px] text-cladd-fg-soft">{busy}</span>
{:else if action.message}
  <span
    class="text-[12px] {action.failed ? "text-expense" : "text-income"}"
    role="status"
    >{action.message}</span
  >
{/if}
