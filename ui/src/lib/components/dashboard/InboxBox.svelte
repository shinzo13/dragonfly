<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { Page, TransactionGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import Money from "#lib/components/Money.svelte";
  import { useColumn } from "#lib/dashboard/column.svelte.js";
  import { reviewed } from "#lib/dashboard/reviewed.svelte.js";
  import { addDays, iso } from "#lib/dates.js";
  import { formatDate, formatDateTime } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import {
    editUrl,
    groupTitle,
    showUrl,
    sumByCurrency,
  } from "#lib/transactions/split.js";
  import { goto } from "$app/navigation";

  const FETCH = 200;
  const SHOW = 10;

  const since = reviewed.until;
  const sinceDay = addDays(iso(new Date(since)), -1);
  const searchHref = `/search?search=${encodeURIComponent(`created_at_after:${sinceDay}`)}`;

  const at = (group: { attributes: TransactionGroup }) =>
    group.attributes.created_at ?? "";

  async function load() {
    const page = await api<Page<TransactionGroup>>("/v1/search/transactions", {
      query: { limit: FETCH, query: `created_at_after:${sinceDay}` },
    });
    if (page.data.length < FETCH) {
      reviewed.compact(page.data.map((g) => ({ at: at(g), id: g.id })));
    }
    return page;
  }

  const inbox = createQuery(() => ({
    queryFn: load,
    queryKey: ["dashboard-inbox", sinceDay],
    refetchOnWindowFocus: true,
  }));

  const fetched = $derived(inbox.data?.data ?? []);
  const entries = $derived(
    fetched
      .filter((g) => Date.parse(at(g)) > Date.parse(since))
      .sort((a, b) => Date.parse(at(b)) - Date.parse(at(a)))
      .map((group) => {
        const [first] = group.attributes.transactions;
        return {
          at: at(group),
          date: first?.date.slice(0, 10) ?? "",
          group,
          id: group.id,
          money: sumByCurrency(group.attributes.transactions),
          note: (first?.notes ?? "").trim().split("\n")[0],
          title: groupTitle(group),
        };
      })
  );
  const shown = $derived(entries.slice(0, SHOW));
  const fresh = $derived(entries.filter((e) => reviewed.isNew(e)).length);

  const markAll = () => reviewed.all(entries);

  useKeys(() => [
    {
      group: "Dashboard",
      keys: "*",
      label: "Mark all entries reviewed",
      run: markAll,
    },
  ]);

  const column = useColumn(2, () =>
    shown.map((e) => ({
      edit: () => goto(editUrl(e.id)),
      key: `inbox-${e.id}`,
      open: () => goto(showUrl(e.id)),
      review: () => reviewed.toggle(e),
    }))
  );
</script>

{#snippet actions()}
  {#if fresh > 0}
    <button
      class="text-brand hover:underline dark:text-(--ff-series-1)"
      onclick={markAll}
      type="button"
    >
      Mark all reviewed <span class="kbd">*</span>
    </button>
  {/if}
  {#if entries.length > SHOW}
    <a class="ml-auto text-cladd-fg-soft hover:underline" href={searchHref}
      >and {entries.length - SHOW} more</a
    >
  {/if}
{/snippet}

<Box
  body="p-0"
  footer={fresh > 0 || entries.length > SHOW ? actions : undefined}
  href={searchHref}
  title="Entered since you last looked"
>
  {#snippet tools()}
    {#if fresh > 0}
      <span class="num text-[12px] text-cladd-fg-soft">{fresh} new</span>
    {/if}
  {/snippet}
  {#if entries.length === 0}
    <p class="px-3 py-2.5 text-[12.5px] text-cladd-fg-soft">
      {inbox.isPending ? "" : `Nothing new since ${formatDateTime(since)}.`}
    </p>
  {:else}
    <table class="w-full border-collapse text-[13px]">
      <tbody>
        {#each shown as e, i (e.id)}
          {@const key = `inbox-${e.id}`}
          {@const isNew = reviewed.isNew(e)}
          <tr
            class="{i > 0
              ? "border-cladd-outline/60 border-t"
              : ""} {column.rowClass(key)}"
            id={column.id(key)}
            onclick={() => column.point(key)}
          >
            <td class="w-7 py-1 pl-2 align-top">
              <button
                aria-label={isNew ? "Mark reviewed" : "Mark as new"}
                aria-pressed={!isNew}
                class="grid size-5 place-items-center rounded-full"
                onclick={() => reviewed.toggle(e)}
                type="button"
              >
                <span
                  class="size-2 rounded-full {isNew
                    ? "bg-brand dark:bg-(--ff-series-1)"
                    : "border border-cladd-fg-softer"}"
                ></span>
              </button>
            </td>
            <td
              class="num w-12 whitespace-nowrap py-1 align-top text-cladd-fg-soft leading-5"
            >
              {formatDate(e.date, "short")}
            </td>
            <td class="w-full max-w-0 py-1 pl-2 align-top leading-5">
              <a
                class="block truncate hover:underline {isNew
                  ? "font-semibold text-cladd-fg"
                  : "text-cladd-fg-soft"}"
                href={showUrl(e.id)}
                title={e.title}
                >{e.title}</a
              >
              {#if e.note}
                <p
                  class="truncate text-[12px] text-cladd-fg-soft"
                  title={e.note}
                >
                  {e.note}
                </p>
              {/if}
            </td>
            <td
              class="whitespace-nowrap py-1 pr-3 pl-2 text-right align-top leading-5"
            >
              {#if e.money.length > 0}
                <Money parts={e.money} tone={e.money[0].tone} />
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Box>
