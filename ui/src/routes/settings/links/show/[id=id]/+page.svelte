<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, TransactionLink } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { Arm, errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import MenuDelete from "#lib/components/misc/MenuDelete.svelte";
  import { muted, td, th } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { page } from "$app/state";
  import Journal from "../../Journal.svelte";
  import { linkQueries } from "../../queries.js";

  const id = $derived(page.params.id ?? "");
  const type = createQuery(() => linkQueries.one(id));
  const name = $derived(type.data?.data.attributes.name);
  const links = createQuery(() => ({
    ...linkQueries.links(name),
    enabled: Boolean(name),
  }));

  const arm = new Arm();
  let notes = $state<Record<string, string>>({});

  async function run(
    item: Item<TransactionLink>,
    task: () => Promise<unknown>
  ) {
    notes = { ...notes, [item.id]: "" };
    try {
      await task();
      await invalidate();
    } catch (error) {
      notes = { ...notes, [item.id]: errorText(error) };
    }
  }

  const swap = (item: Item<TransactionLink>) =>
    run(item, () =>
      api(`/v1/transaction-links/${item.id}`, {
        body: {
          inward_id: item.attributes.outward_id,
          link_type_id: item.attributes.link_type_id,
          outward_id: item.attributes.inward_id,
        },
        method: "PUT",
      })
    );
  const remove = (item: Item<TransactionLink>) =>
    run(item, () =>
      api(`/v1/transaction-links/${item.id}`, { method: "DELETE" })
    );

  const nav: ListNav<Item<TransactionLink>> = new ListNav({
    extra: () => [
      {
        group: "Links",
        keys: "s",
        label: "Switch direction of link",
        run: () => nav.current && swap(nav.current),
      },
      {
        group: "Links",
        keys: "D",
        label: "Delete link (press twice)",
        run: () => {
          const item = nav.current;
          if (item) {
            arm.press(item.id, () => remove(item));
          }
        },
      },
    ],
    id: "links",
    items: () => links.data ?? [],
    key: (item) => item.id,
  });
  nav.use();

  const title = $derived(
    name ? `Overview for link type "${name}"` : "Link type"
  );
</script>

<PageHeader
  crumbs={[
    { href: "/settings", label: "System settings" },
    { href: "/settings/links", label: "Transaction links configuration" },
    { label: name ?? "Link type" },
  ]}
  subtitle="Transaction links configuration"
  title="System settings"
>
  {#snippet actions()}
    {#if type.data?.data.attributes.editable}
      <Button href="/settings/links/edit/{id}" size="sm" variant="outline"
        >Edit link type</Button
      >
    {/if}
  {/snippet}
</PageHeader>

<Box body="p-0" {title}>
  {#if type.error}
    <p class="p-3 text-expense">{errorText(type.error)}</p>
  {:else if links.isPending}
    <p class="p-3 {muted}">Loading links</p>
  {:else if links.error}
    <p class="p-3 text-expense">{errorText(links.error)}</p>
  {:else}
    <ListTable
      empty="No transactions are linked this way yet."
      key={(item) => item.id}
      {nav}
    >
      {#snippet head()}
        <th class="{th} w-[40%]">Inward transaction</th>
        <th class={th}></th>
        <th class="{th} w-[40%]">Outward transaction</th>
        <th class={th}></th>
      {/snippet}
      {#snippet row(
        item
      )}
        <td class={td}><Journal id={item.attributes.inward_id} /></td>
        <td class="{td} text-cladd-fg-soft">
          {type.data?.data.attributes.outward}
        </td>
        <td class={td}><Journal id={item.attributes.outward_id} /></td>
        <td class="{td} text-[12px]">
          {#if arm.key === item.id}
            <span class="text-expense">Press D again to delete</span>
          {:else if notes[item.id]}
            <span class="text-expense">{notes[item.id]}</span>
          {:else if item.attributes.notes}
            <span class="text-cladd-fg-soft">{item.attributes.notes}</span>
          {/if}
        </td>
      {/snippet}
      {#snippet menu(
        item
      )}
        <ContextMenuItem onSelect={() => swap(item)}>
          Switch direction
          <span class="ml-auto kbd">s</span>
        </ContextMenuItem>
        <MenuDelete {arm} id={item.id} run={() => remove(item)} />
      {/snippet}
    </ListTable>
  {/if}
</Box>
