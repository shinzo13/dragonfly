<script lang="ts" module>
  import { api } from "#lib/api/client.js";
  import type { Attachment, One } from "#lib/api/types.js";

  export async function upload(journalId: string, file: File) {
    const created = await api<One<Attachment>>("/v1/attachments", {
      body: {
        attachable_id: journalId,
        attachable_type: "TransactionJournal",
        filename: file.name,
        title: file.name,
      },
      method: "POST",
    });
    try {
      await api(`/v1/attachments/${created.data.id}/upload`, {
        body: new Blob([file], { type: "application/octet-stream" }),
        method: "POST",
      });
    } catch (error) {
      await api(`/v1/attachments/${created.data.id}`, {
        method: "DELETE",
      }).catch(() => undefined);
      throw error;
    }
  }
</script>

<script lang="ts">
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import X from "@lucide/svelte/icons/x";
  import { createQuery } from "@tanstack/svelte-query";
  import { all, invalidate } from "#lib/api/lists.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { formatNumber } from "#lib/format.js";

  let {
    groupId = null,
    journals = [],
    queued = $bindable([]),
  }: {
    groupId?: string | null;
    journals?: { id: string; label: string }[];
    queued?: File[];
  } = $props();

  let input = $state<HTMLInputElement | null>(null);
  let target = $state("");
  let status = $state("");
  let busy = $state(false);

  const existing = createQuery(() => ({
    enabled: Boolean(groupId),
    queryFn: () => all<Attachment>(`/v1/transactions/${groupId}/attachments`),
    queryKey: ["transaction-attachments", groupId],
  }));

  const journalLabel = (id: string | undefined) =>
    journals.length > 1
      ? (journals.find((journal) => journal.id === id)?.label ?? "")
      : "";

  const size = (bytes: number | undefined) =>
    bytes && bytes > 1_048_576
      ? `${formatNumber(bytes / 1_048_576, 1)} MB`
      : `${formatNumber((bytes ?? 0) / 1024, 0)} KB`;

  async function chosen(files: FileList | null) {
    const list = [...(files ?? [])];
    if (input) {
      input.value = "";
    }
    if (!list.length) {
      return;
    }
    if (!groupId) {
      queued = [...queued, ...list];
      return;
    }
    busy = true;
    status = `Uploading ${list.length} file${list.length > 1 ? "s" : ""}`;
    try {
      await Promise.all(
        list.map((file) => upload(target || journals[0].id, file))
      );
      status = `Uploaded ${list.map((file) => file.name).join(", ")}`;
      await invalidate();
    } catch (error) {
      status = `Upload failed: ${error instanceof Error ? error.message : error}`;
    } finally {
      busy = false;
    }
  }

  async function remove(id: string) {
    await api(`/v1/attachments/${id}`, { method: "DELETE" });
    status = "Attachment deleted";
    await invalidate();
  }
</script>

<Box title="Attachments">
  <div class="flex flex-col gap-2">
    {#each existing.data ?? [] as item (item.id)}
      <div class="flex min-h-7 items-center gap-2 text-[13px]">
        <Paperclip class="size-3.5 shrink-0 text-cladd-fg-soft" />
        <a
          class="min-w-0 flex-1 truncate text-brand hover:underline"
          data-sveltekit-reload
          href="/attachments/view/{item.id}"
          rel="noopener"
          target="_blank"
          >{item.attributes.title || item.attributes.filename}</a
        >
        <span class="text-[12px] text-cladd-fg-soft"
          >{journalLabel(item.attributes.attachable_id)}</span
        >
        <span class="num text-[12px] text-cladd-fg-soft"
          >{size(item.attributes.size)}</span
        >
        <ConfirmButton onconfirm={() => remove(item.id)}>Delete</ConfirmButton>
      </div>
    {/each}
    {#each queued as file, index (`${file.name}:${index}`)}
      <div class="flex min-h-7 items-center gap-2 text-[13px]">
        <Paperclip class="size-3.5 shrink-0 text-cladd-fg-soft" />
        <span class="min-w-0 flex-1 truncate">{file.name}</span>
        <span class="text-[12px] text-cladd-fg-soft">uploads after saving</span>
        <button
          aria-label="Remove {file.name}"
          class="grid size-6 place-items-center rounded text-cladd-fg-soft hover:bg-cladd-surface-next hover:text-cladd-fg"
          onclick={() => (queued = queued.filter((_, i) => i !== index))}
          type="button"
        >
          <X class="size-3.5" />
        </button>
      </div>
    {/each}
    <div class="flex flex-wrap items-center gap-2">
      {#if journals.length > 1}
        <select
          aria-label="Attach to split"
          class="cladd-cut h-cladd-md rounded-cladd-md px-2 text-[13px]"
          bind:value={
            () => target || journals[0]?.id,
            (value) => (target = value)
          }
        >
          {#each journals as journal (journal.id)}
            <option value={journal.id}>{journal.label}</option>
          {/each}
        </select>
      {/if}
      <label
        class="cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-focusable-within inline-flex h-cladd-md cursor-pointer items-center gap-1.5 rounded-cladd-md px-2.5 font-semibold text-[12px] text-cladd-fg"
      >
        <Paperclip class="size-3.5" />
        {busy ? "Uploading" : "Add files"}
        <input
          class="sr-only"
          disabled={busy}
          multiple
          onchange={(event) => chosen(event.currentTarget.files)}
          type="file"
          bind:this={input}
        >
      </label>
      {#if status}
        <span class="text-[12px] text-cladd-fg-soft" role="status"
          >{status}</span
        >
      {/if}
    </div>
  </div>
</Box>
