<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Attachment, One } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { Action, errorText } from "#lib/components/misc/action.svelte.js";
  import Field from "#lib/components/misc/Field.svelte";
  import { sizeText } from "#lib/components/misc/queries.js";
  import Status from "#lib/components/misc/Status.svelte";
  import { link, muted, textarea } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import Input from "#lib/components/ui/input/input.svelte";
  import { useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import AttachedTo from "../../AttachedTo.svelte";

  const id = $derived(page.params.id ?? "");
  const query = createQuery(() => ({
    queryFn: () => api<One<Attachment>>(`/v1/attachments/${id}`),
    queryKey: ["attachment", id],
  }));
  const attachment = $derived(query.data?.data.attributes);

  let title = $derived(attachment?.title ?? "");
  let notes = $derived(attachment?.notes ?? "");

  const save = new Action();
  const removal = new Action();
  let element: HTMLFormElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const cleanNotes = notes.trim();
    const cleanTitle = title.trim();
    const kept = !cleanNotes && Boolean(attachment?.notes);
    const ok = await save.run(async () => {
      await api(`/v1/attachments/${id}`, {
        body: {
          ...(cleanNotes ? { notes: cleanNotes } : {}),
          ...(cleanTitle ? { title: cleanTitle } : {}),
        },
        method: "PUT",
      });
      await invalidate();
    });
    if (ok && kept) {
      save.message =
        "Saved. The old notes stay: Firefly III cannot remove notes through its API";
    }
  }

  async function remove() {
    const ok = await removal.run(
      () => api(`/v1/attachments/${id}`, { method: "DELETE" }),
      "Deleted"
    );
    if (ok) {
      await invalidate();
      await goto("/attachments");
    }
  }

  const pageTitle = $derived(
    attachment ? `Edit attachment "${attachment.filename}"` : "Edit attachment"
  );

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: "Update attachment",
      run: () => element?.requestSubmit(),
    },
    {
      group: "Attachments",
      keys: "d",
      label: "Download file",
      run: () => location.assign(`/attachments/download/${id}`),
    },
  ]);
</script>

<PageHeader
  crumbs={[
    { href: "/attachments", label: "Attachments" },
    { label: pageTitle },
  ]}
  title={pageTitle}
/>

{#if attachment}
  <form class="max-w-3xl" onsubmit={submit} bind:this={element}>
    <Box title="Attachment">
      <div class="flex flex-col gap-3">
        <Field label="File name">
          <p class="pt-1.5">
            <a
              class={link}
              data-sveltekit-reload
              href="/attachments/view/{id}"
              rel="noopener"
              target="_blank"
              >{attachment.filename}</a
            >
            <a
              class="ml-3 text-[12px] {link}"
              data-sveltekit-reload
              href="/attachments/download/{id}"
              >Download</a
            >
          </p>
        </Field>
        <Field label="Type">
          <p class="pt-1.5">{attachment.mime}</p>
        </Field>
        <Field label="Size">
          <p class="num pt-1.5">{sizeText(attachment.size)}</p>
        </Field>
        <Field label="Attached to">
          <p class="pt-1.5">
            <AttachedTo
              id={attachment.attachable_id}
              type={attachment.attachable_type}
            />
          </p>
        </Field>
        <Field for="title" label="Title" problem={save.field("title")}>
          <Input id="title" bind:value={title} />
        </Field>
        <Field for="notes" label="Notes" problem={save.field("notes")}>
          <textarea
            class={textarea}
            id="notes"
            rows="5"
            bind:value={notes}
          ></textarea>
        </Field>
      </div>
      {#snippet footer()}
        <Button disabled={save.busy} size="sm" type="submit"
          >Update attachment</Button
        >
        <Status action={save} />
        <span class="ml-auto flex items-center gap-2">
          <Status action={removal} busy="Deleting" />
          <ConfirmButton onconfirm={remove}>Delete attachment</ConfirmButton>
        </span>
      {/snippet}
    </Box>
  </form>
{:else if query.error}
  <p class="text-expense">{errorText(query.error)}</p>
{:else}
  <p class={muted}>Loading attachment</p>
{/if}
