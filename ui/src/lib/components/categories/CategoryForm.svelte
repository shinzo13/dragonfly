<script lang="ts">
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Category, Item, One } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Textarea } from "#lib/components/ui/textarea/index.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";
  import Field from "./Field.svelte";
  import { fieldErrors } from "./form.js";

  let { category }: { category?: Item<Category> } = $props();

  const initial = untrack(() => category)?.attributes;
  let name = $state(initial?.name ?? "");
  let notes = $state(initial?.notes ?? "");
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
      const saved = await api<One<Category>>(
        category ? `/v1/categories/${category.id}` : "/v1/categories",
        {
          body: { name, notes: notes || null },
          method: category ? "PUT" : "POST",
        }
      );
      await invalidate();
      await goto(`/categories/show/${saved.data.id}`);
    } catch (failure) {
      errors = fieldErrors(failure);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!category) {
      return;
    }
    await api(`/v1/categories/${category.id}`, { method: "DELETE" });
    await invalidate();
    await goto("/categories");
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: category ? "Update category" : "Store new category",
      run: () => save(),
    },
  ]);
</script>

<form class="flex flex-col gap-4" onsubmit={save}>
  <div class="grid gap-4 lg:grid-cols-2">
    <Box title="Mandatory fields">
      <Field id="name" issue={errors.name} label="Name">
        <Input autofocus id="name" required bind:value={name} />
      </Field>
    </Box>
    <Box title="Optional fields">
      <Field id="notes" issue={errors.notes} label="Notes">
        <Textarea id="notes" rows={4} bind:value={notes} />
      </Field>
    </Box>
  </div>
  <div class="flex items-center gap-3">
    <Button disabled={busy} type="submit">
      {category ? "Update category" : "Store new category"}
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
    {#if category}
      <span class="ml-auto text-[12px] text-cladd-fg-soft">
        {#if armed}
          Its transactions stay, without a category.
        {/if}
      </span>
      <ConfirmButton onconfirm={remove} bind:armed
        >Delete category</ConfirmButton
      >
    {/if}
  </div>
</form>
