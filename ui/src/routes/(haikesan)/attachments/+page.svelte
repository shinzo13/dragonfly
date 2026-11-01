<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Attachment, Item } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { Arm, errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import MenuDelete from "#lib/components/misc/MenuDelete.svelte";
  import { dateOnly, sizeText } from "#lib/components/misc/queries.js";
  import {
    link,
    muted,
    td,
    tdNum,
    th,
    thNum,
  } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import { formatDate } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";
  import AttachedTo from "./AttachedTo.svelte";

  const query = createQuery(() => ({
    queryFn: () => all<Attachment>("/v1/attachments"),
    queryKey: ["attachments"],
  }));

  const attachments = $derived(
    [...(query.data ?? [])].sort((a, b) =>
      (b.attributes.created_at ?? "").localeCompare(
        a.attributes.created_at ?? ""
      )
    )
  );

  const arm = new Arm();
  let notes = $state<Record<string, string>>({});

  const view = (item: Item<Attachment>) =>
    window.open(`/attachments/view/${item.id}`, "_blank", "noopener");
  const save = (item: Item<Attachment>) =>
    location.assign(`/attachments/download/${item.id}`);
  const edit = (item: Item<Attachment>) => goto(`/attachments/edit/${item.id}`);

  async function remove(item: Item<Attachment>) {
    try {
      await api(`/v1/attachments/${item.id}`, { method: "DELETE" });
      await invalidate();
    } catch (error) {
      notes = { ...notes, [item.id]: errorText(error) };
    }
  }

  const nav: ListNav<Item<Attachment>> = new ListNav({
    edit,
    extra: () => [
      {
        group: "Attachments",
        keys: "d",
        label: "Download file",
        run: () => nav.current && save(nav.current),
      },
      {
        group: "Attachments",
        keys: "D",
        label: "Delete attachment (press twice)",
        run: () => {
          const item = nav.current;
          if (item) {
            arm.press(item.id, () => remove(item));
          }
        },
      },
    ],
    id: "attachments",
    items: () => attachments,
    key: (item) => item.id,
    open: view,
  });
  nav.use();
</script>

<PageHeader crumbs={[{ label: "Attachments" }]} title="Attachments" />

<Box body="p-0" title="List of all attachments">
  {#if query.isPending}
    <p class="p-3 {muted}">Loading attachments</p>
  {:else if query.error}
    <p class="p-3 text-expense">{errorText(query.error)}</p>
  {:else}
    <ListTable
      empty="There are no attachments yet. Add them to a transaction, account or budget when you edit it."
      key={(item) => item.id}
      {nav}
    >
      {#snippet head()}
        <th class={th}>File name</th>
        <th class={th}>Title</th>
        <th class="{thNum} w-24">Size</th>
        <th class="{th} hidden sm:table-cell w-40">Type</th>
        <th class={th}>Attached to</th>
        <th class={th}>Notes</th>
        <th class="{th} hidden sm:table-cell w-28">Uploaded</th>
        <th class={th}></th>
      {/snippet}
      {#snippet row(
        item
      )}
        {@const a = item.attributes}
        <td class={td}>
          <a
            class={link}
            data-sveltekit-reload
            href="/attachments/view/{item.id}"
            rel="noopener"
            target="_blank"
            >{a.filename}</a
          >
        </td>
        <td class={td}>{a.title ?? ""}</td>
        <td class={tdNum}>{sizeText(a.size)}</td>
        <td class="{td} hidden sm:table-cell text-cladd-fg-soft">{a.mime}</td>
        <td class={td}>
          <AttachedTo id={a.attachable_id} type={a.attachable_type} />
        </td>
        <td class="{td} whitespace-pre-line text-[12px] text-cladd-fg-soft">
          {a.notes ?? ""}
        </td>
        <td class="{td} hidden sm:table-cell num">
          {formatDate(dateOnly(a.created_at))}
        </td>
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
        <ContextMenuItem onSelect={() => view(item)}>
          View
          <span class="ml-auto kbd">↵</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => save(item)}>
          Download
          <span class="ml-auto kbd">d</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => edit(item)}>
          Edit
          <span class="ml-auto kbd">e</span>
        </ContextMenuItem>
        <MenuDelete {arm} id={item.id} run={() => remove(item)} />
      {/snippet}
    </ListTable>
  {/if}
</Box>
