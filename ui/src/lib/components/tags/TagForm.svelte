<script lang="ts">
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, One, Tag } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import Field from "#lib/components/categories/Field.svelte";
  import { fieldErrors } from "#lib/components/categories/form.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Textarea } from "#lib/components/ui/textarea/index.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";

  let { tag }: { tag?: Item<Tag> } = $props();

  const initial = untrack(() => tag)?.attributes;
  let name = $state(initial?.tag ?? "");
  let date = $state(initial?.date ?? "");
  let description = $state(initial?.description ?? "");
  let errors = $state<Record<string, string>>({});
  let busy = $state(false);
  let armed = $state(false);

  async function save(event?: Event) {
    event?.preventDefault();
    if (busy) {
      return;
    }
    busy = true;
    errors = {};
    try {
      const saved = await api<One<Tag>>(
        tag ? `/v1/tags/${tag.id}` : "/v1/tags",
        {
          body: {
            date: date || null,
            description: description || null,
            tag: name,
          },
          method: tag ? "PUT" : "POST",
        }
      );
      await invalidate();
      await goto(`/tags/show/${saved.data.id}`);
    } catch (failure) {
      errors = fieldErrors(failure);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!tag) {
      return;
    }
    await api(`/v1/tags/${tag.id}`, { method: "DELETE" });
    await invalidate();
    await goto("/tags");
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: tag ? "Update tag" : "Store new tag",
      run: () => save(),
    },
  ]);
</script>

<form class="flex flex-col gap-4" onsubmit={save}>
  <div class="grid gap-4 lg:grid-cols-[5fr_7fr]">
    <Box title="Mandatory fields">
      <Field id="tag" issue={errors.tag} label="Tag">
        <Input autofocus id="tag" required bind:value={name} />
      </Field>
    </Box>
    <Box title="Optional fields">
      <Field id="date" issue={errors.date} label="Date">
        <Input class="num w-44" id="date" type="date" bind:value={date} />
      </Field>
      <Field id="description" issue={errors.description} label="Description">
        <Textarea id="description" rows={3} bind:value={description} />
      </Field>
    </Box>
  </div>
  <div class="flex items-center gap-3">
    <Button disabled={busy} type="submit">
      {tag ? "Update tag" : "Store new tag"}
    </Button>
    <span class="flex gap-1 text-[12px] text-cladd-fg-soft">
      {#each prettyKeys("mod+Enter") as key (key)}
        <span class="kbd">{key}</span>
      {/each}
    </span>
    {#if busy}
      <span class="text-[12px] text-cladd-fg-soft">Saving</span>
    {:else if errors.form}
      <span class="text-[12px] text-expense">{errors.form}</span>
    {/if}
    {#if tag}
      <span class="ml-auto text-[12px] text-cladd-fg-soft">
        {#if armed}
          Its transactions stay, without this tag.
        {/if}
      </span>
      <ConfirmButton onconfirm={remove} bind:armed>Delete tag</ConfirmButton>
    {/if}
  </div>
</form>
