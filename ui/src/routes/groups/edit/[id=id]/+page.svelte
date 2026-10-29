<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type {
    Bill,
    ObjectGroup,
    One,
    Page,
    PiggyBank,
  } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { LINK } from "#lib/components/groups/object-groups.js";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import Field from "#lib/components/misc/Field.svelte";
  import Status from "#lib/components/misc/Status.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const id = $derived(page.params.id ?? "");

  const group = createQuery(() => ({
    queryFn: () => api<One<ObjectGroup>>(`/v1/object-groups/${id}`),
    queryKey: ["object-group", id],
  }));
  const bills = createQuery(() => ({
    queryFn: () =>
      api<Page<Bill>>(`/v1/object-groups/${id}/bills`, {
        query: { limit: 1000 },
      }),
    queryKey: ["object-group", id, "bills"],
  }));
  const piggies = createQuery(() => ({
    queryFn: () =>
      api<Page<PiggyBank>>(`/v1/object-groups/${id}/piggy-banks`, {
        query: { limit: 1000 },
      }),
    queryKey: ["object-group", id, "piggy-banks"],
  }));

  const current = $derived(group.data?.data.attributes.title ?? "");
  let title = $state<string | null>(null);
  const value = $derived(title ?? current);
  const action = new Action();

  async function save() {
    const next = value.trim();
    const ok = await action.run(() =>
      api(`/v1/object-groups/${id}`, { body: { title: next }, method: "PUT" })
    );
    if (ok) {
      await invalidate();
      await goto("/groups");
    }
  }

  async function remove() {
    const ok = await action.run(() =>
      api(`/v1/object-groups/${id}`, { method: "DELETE" })
    );
    if (ok) {
      await goto("/groups");
      await invalidate();
    }
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: "Update group",
      run: save,
    },
  ]);
</script>

<PageHeader
  crumbs={[{ href: "/groups", label: "Groups" }, { label: current || id }]}
  title={current ? `Edit group "${current}"` : "Edit group"}
/>

{#if group.error}
  <p class="text-expense">{group.error.message}</p>
{:else if !group.data}
  <p class="text-cladd-fg-soft">Loading group</p>
{:else}
  <div class="grid items-start gap-3 lg:grid-cols-2">
    <form
      onsubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Box body="flex flex-col gap-3 p-4" title="Mandatory fields">
        <Field for="group-title" label="Title" problem={action.field("title")}>
          <Input
            id="group-title"
            oninput={(e) => (title = e.currentTarget.value)}
            required
            {value}
          />
        </Field>
        {#snippet footer()}
          <Button disabled={action.busy} size="sm" type="submit">
            Update group <span class="kbd">{prettyKeys("mod+Enter")[0]}</span>
          </Button>
          <Status {action} />
          <ConfirmButton class="ms-auto" onconfirm={remove}
            >Delete</ConfirmButton
          >
        {/snippet}
      </Box>
    </form>
    <Box body="p-3" title="Members">
      {@const billList = bills.data?.data ?? []}
      {@const piggyList = piggies.data?.data ?? []}
      {#if billList.length > 0}
        <h3 class="mb-1 font-semibold text-[12px] text-cladd-fg-soft">
          Subscriptions
        </h3>
        <ul class="mb-3 flex flex-col gap-0.5">
          {#each billList as bill (bill.id)}
            <li>
              <a class={LINK} href="/subscriptions/show/{bill.id}"
                >{bill.attributes.name}</a
              >
            </li>
          {/each}
        </ul>
      {/if}
      {#if piggyList.length > 0}
        <h3 class="mb-1 font-semibold text-[12px] text-cladd-fg-soft">
          Piggy banks
        </h3>
        <ul class="flex flex-col gap-0.5">
          {#each piggyList as piggy (piggy.id)}
            <li>
              <a class={LINK} href="/piggy-banks/show/{piggy.id}"
                >{piggy.attributes.name}</a
              >
            </li>
          {/each}
        </ul>
      {/if}
      {#if billList.length === 0 && piggyList.length === 0}
        <p class="text-cladd-fg-soft">
          {bills.isPending ? "Loading members" : "Nothing is in this group."}
        </p>
      {/if}
    </Box>
  </div>
{/if}
