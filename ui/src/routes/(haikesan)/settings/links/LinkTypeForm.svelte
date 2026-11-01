<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, LinkType } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import Field from "#lib/components/misc/Field.svelte";
  import Status from "#lib/components/misc/Status.svelte";
  import { muted } from "#lib/components/misc/styles.js";
  import Button from "#lib/components/ui/button/button.svelte";
  import Input from "#lib/components/ui/input/input.svelte";
  import { useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";
  import { linkQueries } from "./queries.js";

  let { item }: { item?: Item<LinkType> } = $props();

  const form = $state(
    untrack(() => ({
      inward: item?.attributes.inward ?? "",
      name: item?.attributes.name ?? "",
      outward: item?.attributes.outward ?? "",
    }))
  );
  const locked = $derived(item ? !item.attributes.editable : false);

  const links = createQuery(() => ({
    ...linkQueries.links(item?.attributes.name),
    enabled: Boolean(item),
  }));
  const count = $derived(links.data?.length ?? 0);

  const save = new Action();
  const removal = new Action();
  let element: HTMLFormElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const ok = await save.run(() =>
      item
        ? api(`/v1/link-types/${item.id}`, { body: form, method: "PUT" })
        : api("/v1/link-types", { body: form, method: "POST" })
    );
    if (ok) {
      await invalidate();
      await goto("/settings/links");
    }
  }

  async function remove() {
    if (
      item &&
      (await removal.run(
        () => api(`/v1/link-types/${item.id}`, { method: "DELETE" }),
        "Deleted"
      ))
    ) {
      await invalidate();
      await goto("/settings/links");
    }
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: item ? "Update link type" : "Store new link type",
      run: () => element?.requestSubmit(),
    },
  ]);
</script>

<form class="max-w-3xl" onsubmit={submit} bind:this={element}>
  <Box title="Mandatory fields">
    <div class="flex flex-col gap-3">
      {#if locked}
        <p class={muted}>
          This link type is built into Firefly III and cannot be changed.
        </p>
      {/if}
      <Field
        for="name"
        help='For example "Duplicates"'
        label="Name"
        problem={save.field("name")}
      >
        <Input disabled={locked} id="name" required bind:value={form.name} />
      </Field>
      <Field
        for="inward"
        help='For example "duplicates"'
        label="Inward description"
        problem={save.field("inward")}
      >
        <Input
          disabled={locked}
          id="inward"
          required
          bind:value={form.inward}
        />
      </Field>
      <Field
        for="outward"
        help='For example "is duplicated by"'
        label="Outward description"
        problem={save.field("outward")}
      >
        <Input
          disabled={locked}
          id="outward"
          required
          bind:value={form.outward}
        />
      </Field>
    </div>
    {#snippet footer()}
      {#if !locked}
        <Button disabled={save.busy} size="sm" type="submit">
          {item ? "Update link type" : "Store new link type"}
        </Button>
        <Status action={save} />
      {/if}
      {#if item && !locked}
        <span class="ml-auto flex items-center gap-2">
          <Status action={removal} busy="Deleting" />
          <ConfirmButton
            confirmLabel={count > 0
              ? `Press again to delete it and ${count} links`
              : "Press again to delete"}
            onconfirm={remove}
            >Delete link type</ConfirmButton
          >
        </span>
      {/if}
    {/snippet}
  </Box>
</form>
