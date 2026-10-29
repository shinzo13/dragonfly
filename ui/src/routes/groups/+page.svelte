<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate, lists } from "#lib/api/lists.js";
  import type { Item, ObjectGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { LINK, swapOrder } from "#lib/components/groups/object-groups.js";
  import { errorText } from "#lib/components/misc/action.svelte.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { goto } from "$app/navigation";

  const groupQuery = lists.objectGroups();
  const groups = createQuery(() => groupQuery);
  const bills = createQuery(() => lists.bills());
  const piggies = createQuery(() => lists.piggyBanks());
  const accounts = createQuery(() => lists.accounts("all"));

  const rows = $derived(
    [...(groups.data ?? [])].sort(
      (a, b) => a.attributes.order - b.attributes.order
    )
  );

  interface Member {
    href: string;
    id: string;
    name: string;
  }

  const members = $derived.by(() => {
    const map = new Map<string, Record<string, Member[]>>();
    const add = (
      group: string | null | undefined,
      kind: string,
      member: Member
    ) => {
      if (!group) {
        return;
      }
      const entry = map.get(group) ?? {};
      entry[kind] = [...(entry[kind] ?? []), member];
      map.set(group, entry);
    };
    for (const b of bills.data ?? []) {
      add(b.attributes.object_group_id, "Subscriptions", {
        href: `/subscriptions/show/${b.id}`,
        id: b.id,
        name: b.attributes.name ?? b.id,
      });
    }
    for (const p of piggies.data ?? []) {
      add(p.attributes.object_group_id, "Piggy banks", {
        href: `/piggy-banks/show/${p.id}`,
        id: p.id,
        name: p.attributes.name,
      });
    }
    for (const a of accounts.data ?? []) {
      add(a.attributes.object_group_id, "Accounts", {
        href: `/accounts/show/${a.id}`,
        id: a.id,
        name: a.attributes.name,
      });
    }
    return map;
  });

  let renaming = $state<string | null>(null);
  let title = $state("");
  let menuFor = $state<Item<ObjectGroup> | null>(null);
  let armed = $state(false);
  let failure = $state("");

  async function run(task: () => Promise<unknown>) {
    failure = "";
    try {
      await task();
    } catch (e) {
      failure = errorText(e);
    }
    await invalidate();
  }

  function rename(group: Item<ObjectGroup> | undefined): void {
    if (group) {
      nav.cursor = rows.indexOf(group);
      ({ title } = group.attributes);
      renaming = group.id;
    }
  }

  async function saveTitle(group: Item<ObjectGroup>) {
    const next = title.trim();
    renaming = null;
    if (next && next !== group.attributes.title) {
      await run(() =>
        api(`/v1/object-groups/${group.id}`, {
          body: { title: next },
          method: "PUT",
        })
      );
    }
  }

  function move(dir: 1 | -1): void {
    const { current } = nav;
    const other = rows[nav.cursor + dir];
    if (!(current && other)) {
      return;
    }
    const order = swapOrder(groupQuery.queryKey, current, other);
    nav.move(nav.cursor + dir);
    run(() =>
      api(`/v1/object-groups/${current.id}`, {
        body: { order },
        method: "PUT",
      })
    );
  }

  const nav: ListNav<Item<ObjectGroup>> = new ListNav<Item<ObjectGroup>>({
    edit: (g) => goto(`/groups/edit/${g.id}`),
    extra: () => [
      {
        group: "Groups",
        keys: "r",
        label: "Rename group",
        run: () => rename(nav.current),
      },
      {
        group: "Groups",
        keys: "J",
        label: "Move group down",
        run: () => move(1),
      },
      {
        group: "Groups",
        keys: "K",
        label: "Move group up",
        run: () => move(-1),
      },
    ],
    id: "groups",
    items: () => rows,
    key: (g) => g.id,
    open: (g) => goto(`/groups/edit/${g.id}`),
  });
  nav.use();

  const head =
    "px-3 py-1.5 text-left font-semibold text-[12px] text-cladd-fg-soft";
</script>

<PageHeader crumbs={[{ label: "Groups" }]} subtitle="Overview" title="Groups" />

<Box body="p-0" title="Groups">
  {#snippet tools()}
    {#if failure}
      <span class="text-[12px] text-expense">{failure}</span>
    {/if}
  {/snippet}
  {#if groups.isPending}
    <p class="px-3 py-6 text-cladd-fg-soft">Loading groups</p>
  {:else if rows.length === 0}
    <p class="max-w-prose px-3 py-6 text-cladd-fg-soft">
      Some things in Firefly III can be divided into groups. Piggy banks and
      subscriptions have a "Group" field on their edit page. Give them a group
      and it shows up here.
    </p>
  {:else}
    <ContextMenu onOpenChange={(open) => open || (armed = false)}>
      <ContextMenuTrigger>
        <table class="w-full text-[13px]">
          <thead>
            <tr class="border-cladd-outline border-b">
              <th class="{head} w-10 text-right">#</th>
              <th class="{head} w-1/4">Title</th>
              <th class={head}>Members</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as group, i (group.id)}
              {@const kinds = members.get(group.id) ?? {}}
              <tr
                class="border-cladd-outline/60 border-t align-top {nav.cursor ===
                i
                  ? "bg-row-cursor"
                  : "hover:bg-row-hover"}"
                id={nav.rowId(i)}
                onclick={(e) => nav.click(i, e)}
                oncontextmenu={() => {
                  menuFor = group;
                  nav.cursor = i;
                }}
              >
                <td class="num px-3 py-1.5 text-right text-cladd-fg-softer">
                  {i + 1}
                </td>
                <td class="px-3 py-1">
                  {#if renaming === group.id}
                    <form
                      onsubmit={(e) => {
                        e.preventDefault();
                        saveTitle(group);
                      }}
                    >
                      <Input
                        aria-label="Group title"
                        class="h-7"
                        onblur={() => (renaming = null)}
                        onkeydown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            renaming = null;
                          }
                        }}
                        bind:value={title}
                        {@attach (node) => node.focus()}
                      />
                    </form>
                  {:else}
                    <button
                      class="py-0.5 text-left font-semibold"
                      ondblclick={() => rename(group)}
                      title="Double-click or press r to rename"
                      type="button"
                    >
                      {group.attributes.title}
                    </button>
                  {/if}
                </td>
                <td class="px-3 py-1.5">
                  {#each Object.entries(kinds) as [kind, list] (kind)}
                    <div>
                      <span class="text-cladd-fg-soft">{kind}:</span>
                      {#each list as member, m (member.id)}
                        {#if m > 0}
                          ,
                        {/if}
                        <a class={LINK} href={member.href}>{member.name}</a>
                      {/each}
                    </div>
                  {:else}
                    <span class="text-cladd-fg-softer">Empty</span>
                  {/each}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-48">
        {#if menuFor}
          {@const target = menuFor}
          <ContextMenuItem onSelect={() => rename(target)}
            >Rename</ContextMenuItem
          >
          <ContextMenuItem onSelect={() => goto(`/groups/edit/${target.id}`)}
            >Edit</ContextMenuItem
          >
          <ContextMenuItem
            onSelect={() =>
              location.assign(oldUiUrl(`${location.origin}/groups`))}
            >Open in old UI</ContextMenuItem
          >
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={(e) => {
              if (!armed) {
                e.preventDefault();
                armed = true;
                return;
              }
              run(() =>
                api(`/v1/object-groups/${target.id}`, { method: "DELETE" })
              );
            }}
            variant="destructive"
            >{armed ? "Press again to delete" : "Delete"}</ContextMenuItem
          >
        {/if}
      </ContextMenuContent>
    </ContextMenu>
  {/if}
</Box>
