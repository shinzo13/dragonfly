<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { One, TransactionGroup } from "#lib/api/types.js";
  import { takeDraft } from "#lib/components/editor/draft.js";
  import Editor from "#lib/components/editor/Editor.svelte";
  import {
    emptyForm,
    fromGroup,
    isEditableType,
  } from "#lib/components/editor/model.js";
  import { page } from "$app/state";

  const raw = $derived(
    page.params.type === "transfers" ? "transfer" : (page.params.type ?? "")
  );
  const type = $derived(isEditableType(raw) ? raw : "withdrawal");
  const cloneId = $derived(page.url.searchParams.get("clone"));
  const prefill = $derived({
    destination: page.url.searchParams.get("destination"),
    source: page.url.searchParams.get("source"),
  });
  const draftKey = $derived(page.url.searchParams.get("draft"));

  function blank() {
    const form = emptyForm(type);
    form.splits[0].amount = page.url.searchParams.get("amount") ?? "";
    form.splits[0].description = page.url.searchParams.get("description") ?? "";
    return form;
  }

  const clone = createQuery(() => ({
    enabled: Boolean(cloneId),
    queryFn: () => api<One<TransactionGroup>>(`/v1/transactions/${cloneId}`),
    queryKey: ["transaction", cloneId],
  }));
</script>

{#key `${type}:${cloneId}:${draftKey}`}
  {#if cloneId && clone.isPending}
    <p class="py-8 text-cladd-fg-soft">Loading the transaction to clone</p>
  {:else if cloneId && clone.data}
    <Editor initial={fromGroup(clone.data.data, true)} />
  {:else}
    {@const draft = takeDraft()}
    {#if cloneId && clone.isError}
      <p class="pb-3 text-[13px] text-expense">
        Transaction #{cloneId}
        could not be loaded, so this is an empty form.
      </p>
    {/if}
    <Editor initial={draft ?? blank()} {prefill} />
  {/if}
{/key}
