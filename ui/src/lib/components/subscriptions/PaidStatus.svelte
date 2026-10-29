<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { formatDate } from "#lib/format.js";
  import { STATUS_TONE, type Status, statusText } from "./bills.js";

  let { state }: { state: Status } = $props();
</script>

{#if state.kind === "paid"}
  <span class="inline-flex flex-wrap gap-x-2">
    {#each state.paid as paid (paid.transaction_journal_id)}
      <a
        class="inline-flex items-center gap-1 text-income hover:underline"
        href="/transactions/show/{paid.transaction_group_id}"
        ><Check class="size-3.5 shrink-0" />{formatDate(paid.date, "short")}</a
      >
    {/each}
  </span>
{:else}
  <span class={STATUS_TONE[state.kind]}>{statusText(state)}</span>
{/if}
