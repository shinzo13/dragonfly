<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Item, Webhook } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { Arm, errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import MenuDelete from "#lib/components/misc/MenuDelete.svelte";
  import { link, muted, td, th } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";
  import Disabled from "../Disabled.svelte";
  import {
    DELIVERIES,
    labels,
    RESPONSES,
    switchedOff,
    TRIGGERS,
  } from "../webhooks.js";

  const query = createQuery(() => ({
    queryFn: () => all<Webhook>("/v1/webhooks"),
    queryKey: ["webhooks"],
    retry: false,
  }));
  const off = $derived(switchedOff(query.error));

  const arm = new Arm();
  let notes = $state<Record<string, string>>({});

  const open = (item: Item<Webhook>) => goto(`/webhooks/show/${item.id}`);
  const edit = (item: Item<Webhook>) =>
    location.assign(`/webhooks/edit/${item.id}`);

  async function remove(item: Item<Webhook>) {
    try {
      await api(`/v1/webhooks/${item.id}`, { method: "DELETE" });
      await invalidate();
    } catch (error) {
      notes = { ...notes, [item.id]: errorText(error) };
    }
  }

  const nav: ListNav<Item<Webhook>> = new ListNav({
    edit,
    extra: () => [
      {
        group: "Webhooks",
        keys: "D",
        label: "Delete webhook (press twice)",
        run: () => {
          const item = nav.current;
          if (item) {
            arm.press(item.id, () => remove(item));
          }
        },
      },
      {
        group: "Webhooks",
        keys: "c",
        label: "Create new webhook (old interface)",
        run: () => location.assign("/webhooks/create"),
      },
    ],
    id: "webhooks",
    items: () => query.data ?? [],
    key: (item) => item.id,
    open,
  });
  nav.use();
</script>

<PageHeader crumbs={[{ label: "Webhooks" }]} title="Webhooks">
  {#snippet actions()}
    {#if !off}
      <Button data-sveltekit-reload href="/webhooks/create" size="sm"
        >Create new webhook</Button
      >
    {/if}
  {/snippet}
</PageHeader>

{#if off}
  <Disabled />
{:else}
  <Box body="p-0" title="Webhooks">
    {#snippet tools()}
      <span class="hidden sm:inline {muted}"
        >Creating and editing happens in the old interface</span
      >
    {/snippet}
    {#if query.isPending}
      <p class="p-3 {muted}">Loading webhooks</p>
    {:else if query.error}
      <p class="p-3 text-expense">{errorText(query.error)}</p>
    {:else}
      <ListTable
        empty="There are no webhooks yet."
        key={(item) => item.id}
        {nav}
      >
        {#snippet head()}
          <th class={th}>Title</th>
          <th class={th}>Responds when</th>
          <th class={th}>Responds with (delivery)</th>
          <th class="{th} w-16">Active</th>
          <th class={th}>URL</th>
          <th class={th}></th>
        {/snippet}
        {#snippet row(
          item
        )}
          {@const w = item.attributes}
          <td class="{td} {w.active ? "" : "line-through"}">
            <a class={link} href="/webhooks/show/{item.id}">{w.title}</a>
          </td>
          <td class={td}>{labels(w.triggers, TRIGGERS)}</td>
          <td class={td}>
            {labels(w.responses, RESPONSES)}
            ({labels(w.deliveries, DELIVERIES)})
          </td>
          <td class={td}>{w.active ? "Yes" : "No"}</td>
          <td class="{td} break-all font-mono text-[12px]">{w.url}</td>
          <td class="{td} text-[12px]">
            {#if arm.key === item.id}
              <span class="text-expense">Press D again to delete</span>
            {:else if notes[item.id]}
              <span class="text-expense">{notes[item.id]}</span>
            {/if}
          </td>
        {/snippet}
        {#snippet menu(
          item
        )}
          <ContextMenuItem onSelect={() => open(item)}>
            Inspect
            <span class="ml-auto kbd">↵</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => edit(item)}>
            Edit in the old interface
            <span class="ml-auto kbd">e</span>
          </ContextMenuItem>
          <MenuDelete {arm} id={item.id} run={() => remove(item)} />
        {/snippet}
      </ListTable>
    {/if}
  </Box>
{/if}
