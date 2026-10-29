<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, LinkType } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { Arm, errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import MenuDelete from "#lib/components/misc/MenuDelete.svelte";
  import {
    link,
    muted,
    td,
    tdNum,
    th,
    thNum,
  } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";
  import { linkQueries } from "./queries.js";

  const types = createQuery(linkQueries.types);
  const links = createQuery(() => linkQueries.links());

  const counts = $derived.by(() => {
    const map = new Map<string, number>();
    for (const item of links.data ?? []) {
      const key = item.attributes.link_type_id;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  });

  const list = $derived(
    [...(types.data ?? [])].sort((a, b) =>
      a.attributes.name.localeCompare(b.attributes.name)
    )
  );

  const arm = new Arm();
  let notes = $state<Record<string, string>>({});

  const open = (item: Item<LinkType>) =>
    goto(`/settings/links/show/${item.id}`);
  const edit = (item: Item<LinkType>) => {
    if (item.attributes.editable) {
      goto(`/settings/links/edit/${item.id}`);
    }
  };

  async function remove(item: Item<LinkType>) {
    try {
      await api(`/v1/link-types/${item.id}`, { method: "DELETE" });
      await invalidate();
    } catch (error) {
      notes = { ...notes, [item.id]: errorText(error) };
    }
  }

  const nav: ListNav<Item<LinkType>> = new ListNav({
    edit,
    extra: () => [
      {
        group: "Link types",
        keys: "D",
        label: "Delete link type (press twice)",
        run: () => {
          const item = nav.current;
          if (item?.attributes.editable) {
            arm.press(item.id, () => remove(item));
          }
        },
      },
      {
        group: "Link types",
        keys: "c",
        label: "Create new link type",
        run: () => goto("/settings/links/create"),
      },
    ],
    id: "link-types",
    items: () => list,
    key: (item) => item.id,
    open,
  });
  nav.use();
</script>

<PageHeader
  crumbs={[
    { href: "/settings", label: "System settings" },
    { label: "Transaction links configuration" },
  ]}
  subtitle="Transaction links configuration"
  title="System settings"
>
  {#snippet actions()}
    <Button href="/settings/links/create" size="sm"
      >Create new link type</Button
    >
  {/snippet}
</PageHeader>

<Box body="p-0" title="Transaction links configuration">
  {#if types.isPending}
    <p class="p-3 {muted}">Loading link types</p>
  {:else if types.error}
    <p class="p-3 text-expense">{errorText(types.error)}</p>
  {:else}
    <ListTable key={(item) => item.id} {nav}>
      {#snippet head()}
        <th class={th}>Name</th>
        <th class={th}>Inward description</th>
        <th class={th}>Outward description</th>
        <th class="{thNum} w-48">Number of transactions</th>
        <th class={th}></th>
      {/snippet}
      {#snippet row(
        item
      )}
        {@const t = item.attributes}
        <td class="{td} font-semibold">
          <a class="hover:underline" href="/settings/links/show/{item.id}"
            >{t.name}</a
          >
        </td>
        <td class={td}>{t.inward}</td>
        <td class={td}>{t.outward}</td>
        <td class={tdNum}>
          <a class={link} href="/settings/links/show/{item.id}"
            >{links.data ? (counts.get(item.id) ?? 0) : ""}</a
          >
        </td>
        <td class="{td} text-[12px]">
          {#if arm.key === item.id}
            <span class="text-expense">Press D again to delete</span>
          {:else if notes[item.id]}
            <span class="text-expense">{notes[item.id]}</span>
          {:else if !t.editable}
            <span class="text-cladd-fg-soft">Built in</span>
          {/if}
        </td>
      {/snippet}
      {#snippet menu(
        item
      )}
        <ContextMenuItem onSelect={() => open(item)}>
          Show linked transactions
          <span class="ml-auto kbd">↵</span>
        </ContextMenuItem>
        {#if item.attributes.editable}
          <ContextMenuItem onSelect={() => edit(item)}>
            Edit
            <span class="ml-auto kbd">e</span>
          </ContextMenuItem>
          <MenuDelete {arm} id={item.id} run={() => remove(item)} />
        {/if}
      {/snippet}
    </ListTable>
  {/if}
</Box>
