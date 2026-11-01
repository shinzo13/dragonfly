<script lang="ts">
  import { untrack } from "svelte";
  import AccountShow from "#lib/components/accounts/AccountShow.svelte";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");
  const start = $derived(page.params.start);
  const end = $derived(page.params.end);

  let applied = "";

  $effect(() => {
    const key = `${start}|${end}`;
    if (start && end && key !== applied) {
      applied = key;
      period.set(start <= end ? { end, start } : { end: start, start: end });
      return;
    }
    const moved = period.start !== start || period.end !== end;
    untrack(() => {
      if (start && end && moved) {
        goto(`/accounts/show/${id}`, { replace: true });
      }
    });
  });
</script>

{#key id}
  <AccountShow {id} />
{/key}
