<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import type { Item } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import OldUi from "#lib/components/misc/OldUi.svelte";
  import { muted, td, th } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";
  import { type Group, groupQueries, roleText } from "./groups.js";

  const query = createQuery(groupQueries.all);
  const edit = (item: Item<Group>) => goto(`/administrations/edit/${item.id}`);

  const nav: ListNav<Item<Group>> = new ListNav({
    edit,
    id: "administrations",
    items: () => query.data ?? [],
    key: (item) => item.id,
    open: edit,
  });
  nav.use();
</script>

<PageHeader
  crumbs={[{ label: "Financial administrations" }]}
  subtitle="Overview"
  title="Financial administrations"
/>

<div class="flex flex-col gap-3">
  <OldUi href="/administrations?ffui=old">
    Switching the active administration is not possible through the Firefly III
    API.
  </OldUi>
  <Box body="p-0" title="Financial administrations">
    {#if query.isPending}
      <p class="p-3 {muted}">Loading administrations</p>
    {:else if query.error}
      <p class="p-3 text-expense">{errorText(query.error)}</p>
    {:else}
      <ListTable key={(item) => item.id} {nav}>
        {#snippet head()}
          <th class={th}>Title</th>
          <th class={th}>Primary currency</th>
          <th class={th}>Members</th>
          <th class="{th} w-24">In use</th>
        {/snippet}
        {#snippet row(
          item
        )}
          {@const g = item.attributes}
          <td class={td}>
            <a class="hover:underline" href="/administrations/edit/{item.id}"
              >{g.title}</a
            >
          </td>
          <td class={td}>
            {g.primary_currency_name ?? ""}
            ({g.primary_currency_code})
          </td>
          <td class={td}>
            {#if g.can_see_members}
              {#each g.members ?? [] as member (member.user_id)}
                <div>
                  {member.user_email}{member.you ? " (you)" : ""}
                  <span class="text-cladd-fg-soft"
                    >· {roleText(member.roles)}</span
                  >
                </div>
              {/each}
            {:else}
              <span class="text-cladd-fg-soft">Hidden</span>
            {/if}
          </td>
          <td class={td}>{g.in_use ? "Yes" : "No"}</td>
        {/snippet}
        {#snippet menu(
          item
        )}
          <ContextMenuItem onSelect={() => edit(item)}>
            Edit
            <span class="ml-auto kbd">e</span>
          </ContextMenuItem>
        {/snippet}
      </ListTable>
    {/if}
  </Box>
</div>
