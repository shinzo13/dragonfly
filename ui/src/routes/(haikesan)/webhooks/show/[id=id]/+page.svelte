<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api, type Schemas } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Item, One, Webhook } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { Action, errorText } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import Status from "#lib/components/misc/Status.svelte";
  import { link, muted, td, th } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import Input from "#lib/components/ui/input/input.svelte";
  import { formatDateTime } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Attempts from "../../Attempts.svelte";
  import Disabled from "../../Disabled.svelte";
  import {
    DELIVERIES,
    labels,
    RESPONSES,
    switchedOff,
    TRIGGERS,
  } from "../../webhooks.js";

  type Message = Schemas["WebhookMessage"];

  const id = $derived(page.params.id ?? "");
  const query = createQuery(() => ({
    queryFn: () => api<One<Webhook>>(`/v1/webhooks/${id}`),
    queryKey: ["webhook", id],
    retry: false,
  }));
  const messages = createQuery(() => ({
    enabled: Boolean(query.data),
    queryFn: () => all<Message>(`/v1/webhooks/${id}/messages`),
    queryKey: ["webhook-messages", id],
  }));

  const w = $derived(query.data?.data.attributes);
  const list = $derived(
    [...(messages.data ?? [])].sort((a, b) =>
      (b.attributes.created_at ?? "").localeCompare(
        a.attributes.created_at ?? ""
      )
    )
  );

  let secret = $state(false);
  let transaction = $state("");
  const triggering = new Action();
  const removal = new Action();

  async function trigger(event: SubmitEvent) {
    event.preventDefault();
    const ok = await triggering.run(
      () =>
        api(`/v1/webhooks/${id}/trigger-transaction/${transaction.trim()}`, {
          method: "POST",
        }),
      "Triggered. Results appear below in a moment."
    );
    if (ok) {
      await invalidate();
    }
  }

  async function remove() {
    const ok = await removal.run(
      () => api(`/v1/webhooks/${id}`, { method: "DELETE" }),
      "Deleted"
    );
    if (ok) {
      await invalidate();
      await goto("/webhooks/index");
    }
  }

  const pretty = (text?: string | null) => {
    try {
      return JSON.stringify(JSON.parse(text ?? ""), null, 2);
    } catch {
      return text ?? "";
    }
  };

  const nav: ListNav<Item<Message>> = new ListNav({
    id: "messages",
    items: () => list,
    key: (item) => item.id,
  });
  nav.use();

  const current = $derived(nav.current ?? list[0]);
</script>

<PageHeader
  crumbs={[
    { href: "/webhooks/index", label: "Webhooks" },
    { label: w?.title ?? "Webhook" },
  ]}
  title={w?.title ?? "Webhook"}
/>

{#if switchedOff(query.error)}
  <Disabled href="/webhooks/show/{id}?ffui=old" />
{:else if query.error}
  <p class="text-expense">{errorText(query.error)}</p>
{:else if w}
  <div class="flex flex-col gap-4">
    <div class="grid items-start gap-4 lg:grid-cols-2">
      <Box title={w.title}>
        <dl class="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt class="text-cladd-fg-soft">Title</dt>
          <dd>{w.title}</dd>
          <dt class="text-cladd-fg-soft">Active</dt>
          <dd>{w.active ? "Yes" : "No"}</dd>
          <dt class="text-cladd-fg-soft">Responds when</dt>
          <dd>{labels(w.triggers, TRIGGERS)}</dd>
          <dt class="text-cladd-fg-soft">Responds with</dt>
          <dd>{labels(w.responses, RESPONSES)}</dd>
          <dt class="text-cladd-fg-soft">Delivery</dt>
          <dd>{labels(w.deliveries, DELIVERIES)}</dd>
        </dl>
        {#snippet footer()}
          <Button
            data-sveltekit-reload
            href="/webhooks/edit/{id}"
            size="sm"
            variant="outline"
            >Edit in the old interface</Button
          >
          <span class="ml-auto flex items-center gap-2">
            <Status action={removal} busy="Deleting" />
            <ConfirmButton onconfirm={remove}>Delete</ConfirmButton>
          </span>
        {/snippet}
      </Box>

      <Box title="Meta data">
        <dl class="grid grid-cols-[10rem_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt class="text-cladd-fg-soft">URL</dt>
          <dd class="break-all font-mono text-[12px]">
            <a class={link} href={w.url} rel="noopener" target="_blank"
              >{w.url}</a
            >
          </dd>
          <dt class="text-cladd-fg-soft">Secret</dt>
          <dd class="flex items-center gap-2">
            <span class="break-all font-mono"
              >{secret ? w.secret : "••••••••••••"}</span
            >
            <Button
              onclick={() => (secret = !secret)}
              size="xs"
              variant="outline"
              >{secret ? "Hide" : "Show"}</Button
            >
          </dd>
        </dl>
        {#snippet footer()}
          <form class="flex flex-wrap items-center gap-2" onsubmit={trigger}>
            <label class="text-cladd-fg-soft" for="trigger-id"
              >Send it for transaction</label
            >
            <Input
              class="num h-7 w-28"
              id="trigger-id"
              inputmode="numeric"
              placeholder="ID"
              required
              bind:value={transaction}
            />
            <Button disabled={triggering.busy} size="xs" type="submit"
              >Trigger</Button
            >
            <Status action={triggering} busy="Sending" />
          </form>
        {/snippet}
      </Box>
    </div>

    <div class="grid items-start gap-4 {current ? "lg:grid-cols-2" : ""}">
      <Box body="p-0" title="Webhook messages">
        {#if messages.isPending}
          <p class="p-3 {muted}">Loading messages</p>
        {:else if messages.error}
          <p class="p-3 text-expense">{errorText(messages.error)}</p>
        {:else}
          <ListTable
            empty="This webhook has not sent anything yet."
            key={(item) => item.id}
            {nav}
          >
            {#snippet head()}
              <th class="{th} w-44">Date and time</th>
              <th class={th}>UUID</th>
              <th class="{th} w-16">Sent</th>
              <th class="{th} w-20">Errored</th>
            {/snippet}
            {#snippet row(
              item
            )}
              {@const m = item.attributes}
              <td class="{td} num">{formatDateTime(m.created_at)}</td>
              <td class="{td} num truncate text-[12px]">{m.uuid}</td>
              <td class={td}>{m.sent ? "Yes" : "No"}</td>
              <td class="{td} {m.errored ? "text-expense" : ""}">
                {m.errored ? "Yes" : "No"}
              </td>
            {/snippet}
          </ListTable>
        {/if}
      </Box>

      {#if current}
        <Box title="Message {current.attributes.uuid ?? ""}">
          <pre
            class="max-h-80 overflow-auto whitespace-pre-wrap text-[12px]"
          >{pretty(current.attributes.message)}</pre>
          <h3 class="mt-3 mb-1 font-semibold">Attempts</h3>
          {#key current.id}
            <Attempts message={current.id} webhook={id} />
          {/key}
        </Box>
      {/if}
    </div>
  </div>
{:else}
  <p class={muted}>Loading webhook</p>
{/if}
