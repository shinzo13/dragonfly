<script lang="ts">
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, lists } from "#lib/api/lists.js";
  import type {
    Attachment,
    Item,
    LinkType,
    One,
    Page,
    PiggyBankEvent,
    Split,
    TransactionGroup,
    TransactionLink,
  } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { formatNumber } from "#lib/format.js";
  import {
    journalId,
    type Signed,
    signedAmount,
  } from "#lib/transactions/split.js";

  interface Linked {
    amount: Signed | null;
    description: string;
    group: string | null;
    id: string;
    notes: string;
    phrase: string;
  }

  type Event = Item<PiggyBankEvent> & {
    links?: Record<string, { uri?: string }>;
  };

  const PIGGY_URI = /piggy-banks\/(\d+)/;
  const BYTES_KB = 1024;

  let { id, splits }: { id: string; splits: Split[] } = $props();

  const journals = $derived(splits.map(journalId));

  const attachments = createQuery(() => ({
    queryFn: () =>
      api<Page<Attachment>>(`/v1/transactions/${id}/attachments`, {
        query: { limit: 500 },
      }),
    queryKey: ["transaction-attachments", id],
  }));
  const events = createQuery(() => ({
    queryFn: () =>
      api<Page<PiggyBankEvent>>(`/v1/transactions/${id}/piggy-bank-events`, {
        query: { limit: 500 },
      }),
    queryKey: ["transaction-piggy-events", id],
  }));
  const piggies = createQuery(() => ({
    ...lists.piggyBanks(),
    enabled: (events.data?.data.length ?? 0) > 0,
  }));

  async function loadLinks(ids: string[]): Promise<Linked[]> {
    const [types, ...pages] = await Promise.all([
      all<LinkType>("/v1/link-types"),
      ...ids.map((journal) =>
        api<Page<TransactionLink>>(`/v1/transaction-journals/${journal}/links`)
      ),
    ]);
    const found = await Promise.all(
      ids.flatMap((journal, index) =>
        pages[index].data.map(async (link) => {
          const { inward_id, outward_id, link_type_id, notes } =
            link.attributes;
          const source = inward_id === journal;
          const other = source ? outward_id : inward_id;
          const linkType = types.find((t) => t.id === link_type_id);
          const group = await api<One<TransactionGroup>>(
            `/v1/transaction-journals/${other}`
          ).catch(() => null);
          const split = group?.data.attributes.transactions.find(
            (s) => journalId(s) === other
          );
          return {
            amount: split ? signedAmount(split) : null,
            description: split?.description ?? `#${other}`,
            group: group?.data.id ?? null,
            id: link.id,
            notes: notes ?? "",
            phrase:
              (source
                ? linkType?.attributes.outward
                : linkType?.attributes.inward) ?? "linked to",
          };
        })
      )
    );
    return [...new Map(found.map((link) => [link.id, link])).values()];
  }

  const links = createQuery(() => ({
    enabled: journals.length > 0,
    queryFn: () => loadLinks(journals),
    queryKey: ["transaction-links", id, journals.join(",")],
  }));

  async function removeLink(linkId: string) {
    await api(`/v1/transaction-links/${linkId}`, { method: "DELETE" });
    await links.refetch();
  }

  function piggyOf(event: Event) {
    const uri = Object.values(event.links ?? {}).find((l) => l?.uri)?.uri;
    const piggyId = uri?.match(PIGGY_URI)?.[1];
    const name = (piggies.data ?? []).find((p) => p.id === piggyId)?.attributes
      .name;
    return { id: piggyId, name: name ?? (piggyId ? `#${piggyId}` : "") };
  }

  const files = $derived(attachments.data?.data ?? []);
  const piggyEvents = $derived((events.data?.data ?? []) as Event[]);
  const linked = $derived(links.data ?? []);
  const count = $derived(
    [files, piggyEvents, linked].filter((list) => list.length > 0).length
  );
</script>

{#if count > 0}
  <div class="grid items-stretch gap-3 {count > 1 ? "lg:grid-cols-2" : ""}">
    {#if linked.length}
      <Box body="p-0" title="Transaction links">
        <ul class="[&>li+li]:border-cladd-outline [&>li+li]:border-t">
          {#each linked as link (link.id)}
            <li class="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5">
              <span class="text-cladd-fg-soft">{link.phrase}</span>
              {#if link.group}
                <a
                  class="text-brand hover:underline"
                  href="/transactions/show/{link.group}"
                  >{link.description}</a
                >
              {:else}
                <span>{link.description}</span>
              {/if}
              {#if link.amount}
                <Amount
                  amount={link.amount.amount}
                  code={link.amount.code}
                  decimals={link.amount.decimals}
                  symbol={link.amount.symbol}
                  tone={link.amount.tone}
                />
              {/if}
              {#if link.notes}
                <span class="text-cladd-fg-soft">({link.notes})</span>
              {/if}
              <ConfirmButton
                class="ml-auto"
                confirmLabel="Press again to remove"
                onconfirm={() => removeLink(link.id)}
              >
                Remove link
              </ConfirmButton>
            </li>
          {/each}
        </ul>
      </Box>
    {/if}

    {#if files.length}
      <Box body="p-0" title="Attachments">
        <ul class="[&>li+li]:border-cladd-outline [&>li+li]:border-t">
          {#each files as file (file.id)}
            <li class="flex flex-col gap-0.5 px-3 py-1.5">
              <span class="flex items-center gap-2">
                <Paperclip class="size-3.5 text-cladd-fg-soft" />
                <a
                  class="min-w-0 truncate text-brand hover:underline"
                  data-sveltekit-reload
                  href="/attachments/view/{file.id}"
                  >{file.attributes.title || file.attributes.filename}</a
                >
                <span class="num text-cladd-fg-soft"
                  >{formatNumber((file.attributes.size ?? 0) / BYTES_KB, 1)}
                  KB</span
                >
                <a
                  class="ml-auto text-[12px] text-cladd-fg-soft hover:text-cladd-fg hover:underline"
                  data-sveltekit-reload
                  href="/attachments/download/{file.id}"
                  >Download</a
                >
              </span>
              {#if file.attributes.notes}
                <span class="whitespace-pre-line text-[12px] text-cladd-fg-soft"
                  >{file.attributes.notes}</span
                >
              {/if}
            </li>
          {/each}
        </ul>
      </Box>
    {/if}

    {#if piggyEvents.length}
      <Box body="p-0" title="Piggy banks">
        <ul class="[&>li+li]:border-cladd-outline [&>li+li]:border-t">
          {#each piggyEvents as piggyEvent (piggyEvent.id)}
            {@const piggy = piggyOf(piggyEvent)}
            <li class="flex items-center justify-between gap-3 px-3 py-1.5">
              {#if piggy.id}
                <a
                  class="text-brand hover:underline"
                  href="/piggy-banks/show/{piggy.id}"
                  >{piggy.name}</a
                >
              {:else}
                <span>Piggy bank</span>
              {/if}
              <Amount
                amount={piggyEvent.attributes.amount}
                code={piggyEvent.attributes.currency_code}
                decimals={piggyEvent.attributes.currency_decimal_places}
                symbol={piggyEvent.attributes.currency_symbol}
              />
            </li>
          {/each}
        </ul>
      </Box>
    {/if}
  </div>
{/if}
