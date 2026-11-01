<script lang="ts">
  import type { Snippet } from "svelte";
  import Box from "#lib/components/Box.svelte";
  import type { Action } from "#lib/components/misc/action.svelte.js";
  import Status from "#lib/components/misc/Status.svelte";
  import { muted } from "#lib/components/misc/styles.js";
  import Button from "#lib/components/ui/button/button.svelte";

  let {
    title,
    help,
    action,
    onsave,
    children,
  }: {
    title: string;
    help?: string;
    action: Action;
    onsave: () => unknown;
    children: Snippet;
  } = $props();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    await onsave();
  }
</script>

<form class="flex min-w-0" onsubmit={submit}>
  <Box class="w-full" {title}>
    {#if help}
      <p class="mb-3 {muted}">{help}</p>
    {/if}
    {@render children()}
    {#snippet footer()}
      <Button disabled={action.busy} size="sm" type="submit">Save</Button>
      <Status {action} />
    {/snippet}
  </Box>
</form>
