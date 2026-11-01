<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import type { Schemas } from "#lib/api/client.js";
  import { all } from "#lib/api/lists.js";
  import { errorText } from "#lib/components/misc/action.svelte.js";
  import { muted } from "#lib/components/misc/styles.js";
  import { formatDateTime } from "#lib/format.js";

  let { webhook, message }: { webhook: string; message: string } = $props();

  const query = createQuery(() => ({
    queryFn: () =>
      all<Schemas["WebhookAttempt"]>(
        `/v1/webhooks/${webhook}/messages/${message}/attempts`
      ),
    queryKey: ["webhook-attempts", webhook, message],
  }));
</script>

{#if query.isPending}
  <p class={muted}>Loading attempts</p>
{:else if query.error}
  <p class="text-expense">{errorText(query.error)}</p>
{:else}
  {#each query.data ?? [] as attempt (attempt.id)}
    {@const a = attempt.attributes}
    <section class="flex flex-col gap-1 border-cladd-outline border-t py-2">
      <p class="flex gap-3">
        <span class="num">Attempt at {formatDateTime(a.created_at)}</span>
        <span
          class="num {a.status_code && a.status_code < 300
            ? "text-income"
            : "text-expense"}"
          >{a.status_code ?? "no answer"}</span
        >
      </p>
      {#if a.logs}
        <pre
          class="max-h-40 overflow-auto whitespace-pre-wrap text-[12px] text-cladd-fg-soft"
        >{a.logs}</pre>
      {/if}
      {#if a.response}
        <pre
          class="max-h-40 overflow-auto whitespace-pre-wrap text-[12px]"
        >{a.response}</pre>
      {/if}
    </section>
  {:else}
    <p class={muted}>No attempts yet.</p>
  {/each}
{/if}
