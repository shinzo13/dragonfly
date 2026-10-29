<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { ApiError, api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type {
    LinkType,
    One,
    Page,
    TransactionGroup,
    TransactionLink,
  } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import AutocompleteInput, {
    type Option,
  } from "#lib/components/inputs/AutocompleteInput.svelte";
  import Field from "#lib/components/inputs/Field.svelte";
  import { INPUT } from "#lib/components/inputs/styles.js";
  import { formatDate, formatMoney } from "#lib/format.js";

  let { journals }: { journals: { id: string; label: string }[] } = $props();

  interface Row {
    id: string;
    journal: string;
    notes: string;
    other: { description: string; group: string; money: string } | null;
    phrase: string;
  }

  let from = $state("");
  let kind = $state("");
  let notes = $state("");
  let search = $state("");
  let picked = $state<Option | null>(null);
  let status = $state("");

  const ids = $derived(journals.map((journal) => journal.id));

  const types = createQuery(() => ({
    queryFn: () => all<LinkType>("/v1/link-types"),
    queryKey: ["link-types"],
  }));

  const phrases = $derived(
    [...(types.data ?? [])]
      .sort(
        (a, b) =>
          Number(b.attributes.name === "Related") -
          Number(a.attributes.name === "Related")
      )
      .flatMap((item) => [
        { label: item.attributes.outward, value: `${item.id}:outward` },
        ...(item.attributes.inward === item.attributes.outward
          ? []
          : [{ label: item.attributes.inward, value: `${item.id}:inward` }]),
      ])
  );

  async function describe(journalId: string) {
    const group = await api<One<TransactionGroup>>(
      `/v1/transaction-journals/${journalId}`
    ).catch(() => null);
    const split = group?.data.attributes.transactions.find(
      (item) => item.transaction_journal_id === journalId
    );
    if (!(group && split)) {
      return null;
    }
    return {
      description: split.description,
      group: group.data.id,
      money: formatMoney({
        amount: split.amount,
        decimals: split.currency_decimal_places,
        symbol: split.currency_symbol,
      }),
    };
  }

  const links = createQuery(() => ({
    enabled: ids.length > 0 && types.isSuccess,
    queryFn: async (): Promise<Row[]> => {
      const pages = await Promise.all(
        ids.map((id) =>
          api<Page<TransactionLink>>(`/v1/transaction-journals/${id}/links`)
        )
      );
      const byType = new Map(
        (types.data ?? []).map((item) => [item.id, item.attributes])
      );
      const seen = new Set<string>();
      const found: {
        link: Page<TransactionLink>["data"][number];
        own: string;
      }[] = [];
      for (const [index, page] of pages.entries()) {
        for (const link of page.data) {
          if (!seen.has(link.id)) {
            seen.add(link.id);
            found.push({ link, own: ids[index] });
          }
        }
      }
      const rows: Row[] = await Promise.all(
        found.map(async ({ link, own }) => {
          const outgoing = link.attributes.inward_id === own;
          const type = byType.get(link.attributes.link_type_id);
          return {
            id: link.id,
            journal: own,
            notes: link.attributes.notes ?? "",
            other: await describe(
              outgoing ? link.attributes.outward_id : link.attributes.inward_id
            ),
            phrase: (outgoing ? type?.outward : type?.inward) ?? "",
          };
        })
      );
      return rows;
    },
    queryKey: ["journal-links", ids],
  }));

  const searchTransactions = async (query: string): Promise<Option[]> => {
    if (!query.trim()) {
      return [];
    }
    const items = await api<
      {
        id: string;
        description: string;
        date?: string;
        amount?: string;
        currency_code?: string;
      }[]
    >("/v1/autocomplete/transactions-with-meta", {
      query: { limit: 10, query },
    });
    return items
      .filter((item) => !ids.includes(String(item.id)))
      .map((item) => ({
        hint: item.amount
          ? `${formatMoney({ amount: item.amount, code: item.currency_code })}`
          : undefined,
        id: String(item.id),
        label: item.description,
        meta: item.date ? formatDate(item.date, "medium") : undefined,
      }));
  };

  async function add() {
    const own = from || ids[0];
    const [typeId, direction] = (kind || phrases[0]?.value || "").split(":");
    if (!(picked && typeId)) {
      status = "Pick a transaction to link";
      return;
    }
    const outward = direction === "outward";
    try {
      await api("/v1/transaction-links", {
        body: {
          inward_id: outward ? own : picked.id,
          link_type_id: typeId,
          notes: notes.trim() || null,
          outward_id: outward ? picked.id : own,
        },
        method: "POST",
      });
      status = `Linked to "${picked.label}"`;
      picked = null;
      search = "";
      notes = "";
      await invalidate();
    } catch (error) {
      status =
        error instanceof ApiError
          ? (Object.values(error.errors)[0]?.[0] ?? error.message)
          : String(error);
    }
  }

  async function remove(id: string) {
    await api(`/v1/transaction-links/${id}`, { method: "DELETE" });
    status = "Link deleted";
    await invalidate();
  }

  const journalLabel = (id: string) =>
    journals.length > 1
      ? (journals.find((journal) => journal.id === id)?.label ?? "")
      : "This transaction";
</script>

<Box title="Transaction links">
  <div class="flex flex-col gap-3">
    {#if links.data?.length}
      <ul class="flex flex-col gap-1.5">
        {#each links.data as row (row.id)}
          <li class="flex min-h-7 flex-wrap items-center gap-x-2 text-[13px]">
            <span class="text-cladd-fg-soft">{journalLabel(row.journal)}</span>
            <span>{row.phrase}</span>
            {#if row.other}
              <a
                class="min-w-0 truncate text-brand hover:underline"
                href="/transactions/show/{row.other.group}"
                >"{row.other.description}"</a
              >
              <span class="num text-cladd-fg-soft">({row.other.money})</span>
            {/if}
            {#if row.notes}
              <span class="text-cladd-fg-soft">{row.notes}</span>
            {/if}
            <ConfirmButton class="ml-auto" onconfirm={() => remove(row.id)}
              >Delete</ConfirmButton
            >
          </li>
        {/each}
      </ul>
    {:else if links.isSuccess}
      <p class="text-[13px] text-cladd-fg-soft">No links yet.</p>
    {/if}
    <div class="grid gap-2 sm:grid-cols-2">
      {#if journals.length > 1}
        <Field for="link-from" label="Split">
          <select
            class={INPUT}
            id="link-from"
            bind:value={() => from || ids[0], (value) => (from = value)}
          >
            {#each journals as journal (journal.id)}
              <option value={journal.id}>{journal.label}</option>
            {/each}
          </select>
        </Field>
      {/if}
      <Field for="link-type" label="This transaction">
        <select
          class={INPUT}
          id="link-type"
          bind:value={
            () => kind || phrases[0]?.value,
            (value) => (kind = value)
          }
        >
          {#each phrases as phrase (phrase.value)}
            <option value={phrase.value}>{phrase.label}</option>
          {/each}
        </select>
      </Field>
      <Field
        class={journals.length > 1 ? "sm:col-span-2" : ""}
        for="link-search"
        label="Transaction"
      >
        <AutocompleteInput
          async
          id="link-search"
          placeholder="Search by description or #id"
          search={searchTransactions}
          bind:selected={picked}
          bind:value={search}
        />
      </Field>
      <Field class="sm:col-span-2" for="link-notes" label="Notes">
        <input class={INPUT} id="link-notes" bind:value={notes}>
      </Field>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-md items-center rounded-cladd-md px-2.5 font-semibold text-[12px] text-cladd-fg"
        onclick={add}
        type="button"
      >
        Link transaction
      </button>
      {#if status}
        <span class="text-[12px] text-cladd-fg-soft" role="status"
          >{status}</span
        >
      {/if}
    </div>
  </div>
</Box>
