<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Item, Recurrence } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import { Arm, errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import MenuDelete from "#lib/components/misc/MenuDelete.svelte";
  import { dateOnly } from "#lib/components/misc/queries.js";
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
  import { formatDate } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";
  import {
    describe,
    endsText,
    stopped,
    TYPES,
    toneOf,
    upcoming,
  } from "./recurrence.js";

  const query = createQuery(() => ({
    queryFn: () => all<Recurrence>("/v1/recurrences"),
    queryKey: ["recurrences"],
  }));
  const list = $derived(
    [...(query.data ?? [])].sort(
      (a, b) =>
        Number(b.attributes.active) - Number(a.attributes.active) ||
        (a.attributes.title ?? "").localeCompare(b.attributes.title ?? "")
    )
  );

  const arm = new Arm();
  let notes = $state<Record<string, string>>({});

  const open = (item: Item<Recurrence>) => goto(`/recurring/show/${item.id}`);
  const edit = (item: Item<Recurrence>) =>
    location.assign(`/recurring/edit/${item.id}`);

  async function remove(item: Item<Recurrence>) {
    try {
      await api(`/v1/recurrences/${item.id}`, { method: "DELETE" });
      await invalidate();
    } catch (error) {
      notes = { ...notes, [item.id]: errorText(error) };
    }
  }

  const nav: ListNav<Item<Recurrence>> = new ListNav({
    edit,
    extra: () => [
      {
        group: "Recurring transactions",
        keys: "D",
        label: "Delete recurring transaction (press twice)",
        run: () => {
          const item = nav.current;
          if (item) {
            arm.press(item.id, () => remove(item));
          }
        },
      },
      {
        group: "Recurring transactions",
        keys: "c",
        label: "Create a recurring transaction (old interface)",
        run: () => location.assign("/recurring/create"),
      },
    ],
    id: "recurring",
    items: () => list,
    key: (item) => item.id,
    open,
  });
  nav.use();
</script>

<PageHeader
  crumbs={[{ label: "Recurring transactions" }]}
  title="Recurring transactions"
>
  {#snippet actions()}
    <Button data-sveltekit-reload href="/recurring/create" size="sm"
      >Create a recurring transaction</Button
    >
  {/snippet}
</PageHeader>

<Box body="p-0" title="Recurring transactions">
  {#snippet tools()}
    <span class="hidden sm:inline {muted}"
      >Creating and editing happens in the old interface</span
    >
  {/snippet}
  {#if query.isPending}
    <p class="p-3 {muted}">Loading recurring transactions</p>
  {:else if query.error}
    <p class="p-3 text-expense">{errorText(query.error)}</p>
  {:else}
    <ListTable
      empty="You have no recurring transactions yet. Use them to make Firefly III create transactions for you on a schedule."
      key={(item) => item.id}
      {nav}
    >
      {#snippet head()}
        <th class={th}>Title</th>
        <th class="{th} hidden sm:table-cell w-24">Type</th>
        <th class="{thNum} w-32">Amount</th>
        <th class={th}>From → to</th>
        <th class={th}>Repetitions</th>
        <th class="{th} w-32">Next</th>
        <th class="{th} hidden sm:table-cell w-16">Active</th>
        <th class={th}></th>
      {/snippet}
      {#snippet row(
        item
      )}
        {@const r = item.attributes}
        {@const tx = r.transactions?.[0]}
        <td class="{td} {r.active ? "" : "text-cladd-fg-soft line-through"}">
          <a class={link} href="/recurring/show/{item.id}">{r.title}</a>
          {#if r.description}
            <div class="text-[12px] text-cladd-fg-soft no-underline">
              {r.description}
            </div>
          {/if}
        </td>
        <td class="{td} hidden sm:table-cell">
          {TYPES[r.type ?? ""] ?? r.type}
        </td>
        <td class={tdNum}>
          {#each r.transactions ?? [] as split, i (split.id ?? i)}
            <div>
              <Amount
                amount={split.amount}
                code={split.currency_code}
                decimals={split.currency_decimal_places}
                symbol={split.currency_symbol}
                tone={toneOf(r.type)}
              />
            </div>
          {/each}
        </td>
        <td class={td}>
          {#if tx}
            <a class="hover:underline" href="/accounts/show/{tx.source_id}"
              >{tx.source_name}</a
            >
            →
            <a class="hover:underline" href="/accounts/show/{tx.destination_id}"
              >{tx.destination_name}</a
            >
          {/if}
        </td>
        <td class={td}>
          {#each r.repetitions ?? [] as rep, i (rep.id ?? i)}
            <div>{describe(rep)}</div>
          {/each}
          <div
            class="text-[12px] {stopped(r)
              ? "text-expense"
              : "text-cladd-fg-soft"}"
          >
            {stopped(r)
              ? `Stopped repeating on ${formatDate(dateOnly(r.repeat_until))}`
              : endsText(r)}
          </div>
        </td>
        <td class="{td} num">
          {#each upcoming(r, 2) as date (date)}
            <div>{formatDate(date)}</div>
          {/each}
        </td>
        <td class="{td} hidden sm:table-cell">{r.active ? "Yes" : "No"}</td>
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
          Show
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
