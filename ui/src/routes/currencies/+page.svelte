<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { ApiError, api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Currency, Item } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { Arm, errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import MenuDelete from "#lib/components/misc/MenuDelete.svelte";
  import { misc } from "#lib/components/misc/queries.js";
  import { muted, td, tdNum, th, thNum } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";

  const CONFLICT = 409;

  const query = createQuery(misc.currencies);
  const me = createQuery(misc.me);
  const owner = $derived(me.data?.role === "owner");

  const rank = (c: Currency) => {
    if (c.primary) {
      return 0;
    }
    return c.enabled ? 1 : 2;
  };

  const currencies = $derived(
    [...(query.data ?? [])].sort(
      (a, b) =>
        rank(a.attributes) - rank(b.attributes) ||
        a.attributes.code.localeCompare(b.attributes.code)
    )
  );

  let notes = $state<Record<string, string>>({});
  let pending = $state<Record<string, boolean>>({});
  const arm = new Arm();

  async function act(item: Item<Currency>, path: string, method = "POST") {
    notes = { ...notes, [item.id]: "" };
    try {
      await api(`/v1/currencies/${item.attributes.code}${path}`, { method });
      await Promise.all([invalidate(), session.loadCurrencies()]);
    } catch (error) {
      const text =
        error instanceof ApiError && error.status === CONFLICT
          ? "Still in use or the last enabled currency"
          : errorText(error);
      notes = { ...notes, [item.id]: text };
    }
  }

  async function toggle(item: Item<Currency>) {
    const next = !item.attributes.enabled;
    pending = { ...pending, [item.id]: next };
    await act(item, next ? "/enable" : "/disable");
    const { [item.id]: _, ...rest } = pending;
    pending = rest;
  }

  const makePrimary = (item: Item<Currency>) => act(item, "/primary");
  const remove = (item: Item<Currency>) => act(item, "", "DELETE");
  const edit = (item: Item<Currency>) => goto(`/currencies/edit/${item.id}`);

  const nav: ListNav<Item<Currency>> = new ListNav({
    edit,
    extra: () => [
      {
        group: "Currencies",
        keys: "t",
        label: "Enable or disable currency",
        run: () => nav.current && toggle(nav.current),
      },
      {
        group: "Currencies",
        keys: "P",
        label: "Make primary currency",
        run: () => nav.current && makePrimary(nav.current),
      },
      {
        group: "Currencies",
        keys: "D",
        label: "Delete currency (press twice)",
        run: () => {
          const item = nav.current;
          if (item) {
            arm.press(item.id, () => remove(item));
          }
        },
      },
      {
        group: "Currencies",
        keys: "c",
        label: "Create a new currency",
        run: () => goto("/currencies/create"),
      },
    ],
    id: "currencies",
    items: () => currencies,
    key: (item) => item.id,
    open: edit,
  });
  nav.use();
</script>

<PageHeader crumbs={[{ label: "Currencies" }]} title="Currencies">
  {#snippet actions()}
    {#if owner}
      <Button href="/currencies/create" size="sm">Create a new currency</Button>
    {/if}
  {/snippet}
</PageHeader>

<Box body="p-0" title="Currencies">
  {#snippet tools()}
    {#if me.data && !owner}
      <span class={muted}
        >Ask the site owner to add, remove or edit currencies</span
      >
    {/if}
  {/snippet}
  {#if query.isPending}
    <p class="p-3 {muted}">Loading currencies</p>
  {:else if query.error}
    <p class="p-3 text-expense">{errorText(query.error)}</p>
  {:else}
    <ListTable key={(item) => item.id} {nav}>
      {#snippet head()}
        <th class="{th} w-20">Enabled</th>
        <th class="{th} w-16">Code</th>
        <th class={th}>Currency</th>
        <th class="{th} hidden sm:table-cell w-20">Symbol</th>
        <th class="{thNum} hidden sm:table-cell w-36">Number of decimals</th>
        <th class="{th} w-40">Primary</th>
        <th class={th}></th>
      {/snippet}
      {#snippet row(
        item
      )}
        {@const c = item.attributes}
        <td class={td}>
          <input
            aria-label="Enabled"
            checked={pending[item.id] ?? c.enabled}
            class="size-3.5 accent-brand align-middle"
            disabled={c.primary}
            onchange={() => toggle(item)}
            type="checkbox"
          >
        </td>
        <td class="{td} num {c.enabled ? "" : "text-cladd-fg-soft"}">
          {c.code}
        </td>
        <td class="{td} {c.enabled ? "" : "text-cladd-fg-soft"}">
          <a class="hover:underline" href="/currencies/edit/{item.id}"
            >{c.name}</a
          >
        </td>
        <td
          class="{td} hidden sm:table-cell {c.enabled
            ? ""
            : "text-cladd-fg-soft"}"
        >
          {c.symbol}
        </td>
        <td class="{tdNum} hidden sm:table-cell">{c.decimal_places}</td>
        <td class={td}>
          {#if c.primary}
            <span class="font-semibold text-brand">Primary currency</span>
          {:else if c.enabled}
            <Button
              onclick={() => makePrimary(item)}
              size="xs"
              variant="outline"
              >Make primary</Button
            >
          {/if}
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
        <ContextMenuItem onSelect={() => edit(item)}>
          Edit
          <span class="ml-auto kbd">e</span>
        </ContextMenuItem>
        {#if !item.attributes.primary}
          <ContextMenuItem onSelect={() => toggle(item)}>
            {item.attributes.enabled ? "Disable" : "Enable"}
            <span class="ml-auto kbd">t</span>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => makePrimary(item)}>
            Make primary
            <span class="ml-auto kbd">P</span>
          </ContextMenuItem>
          <MenuDelete {arm} id={item.id} run={() => remove(item)} />
        {/if}
      {/snippet}
    </ListTable>
  {/if}
</Box>
