<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate, lists } from "#lib/api/lists.js";
  import type { Item, One, PiggyBank } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import GroupInput from "#lib/components/groups/GroupInput.svelte";
  import { amountString } from "#lib/components/inputs/parse.js";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import Field from "#lib/components/misc/Field.svelte";
  import Status from "#lib/components/misc/Status.svelte";
  import { select, textarea } from "#lib/components/misc/styles.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { today } from "#lib/dates.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";

  let { piggy }: { piggy?: Item<PiggyBank> } = $props();

  const initial = untrack(() => piggy?.attributes);
  const form = $state({
    currency_code: initial?.currency_code ?? session.primary?.code ?? "",
    name: initial?.name ?? "",
    notes: initial?.notes ?? "",
    object_group_title: initial?.object_group_title ?? "",
    start_date: initial?.start_date?.slice(0, 10) ?? today(),
    target_amount: initial?.target_amount ?? "",
    target_date: initial?.target_date?.slice(0, 10) ?? "",
  });
  const linked = $state<Record<string, string>>(
    Object.fromEntries(
      (initial?.accounts ?? []).map((a) => [
        a.account_id ?? "",
        a.current_amount ?? "0",
      ])
    )
  );

  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));
  const accounts = $derived(
    [...(assets.data ?? []), ...(liabilities.data ?? [])].filter(
      (a) =>
        a.id in linked ||
        (a.attributes.active &&
          a.attributes.currency_code === form.currency_code)
    )
  );
  const currencies = $derived(
    session.currencies.filter(
      (c) => c.attributes.enabled || c.attributes.code === form.currency_code
    )
  );
  const decimals = $derived(
    currencies.find((c) => c.attributes.code === form.currency_code)?.attributes
      .decimal_places ?? 2
  );

  const action = new Action();

  function toggle(id: string, on: boolean) {
    if (on) {
      linked[id] = "0";
    } else {
      delete linked[id];
    }
  }

  const snapshot = (entries: [string, string][]) =>
    JSON.stringify(
      entries
        .map(([id, amount]) => [id, amountString(amount, decimals) || "0"])
        .sort()
    );
  const before = snapshot(Object.entries(linked));

  function body() {
    const entries = Object.entries(linked);
    return {
      accounts:
        piggy && snapshot(entries) === before
          ? undefined
          : entries.map(([id, amount]) => ({
              account_id: id,
              current_amount: amountString(amount, decimals) || "0",
            })),
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      object_group_title:
        form.object_group_title.trim() ||
        (initial?.object_group_title ? "" : undefined),
      start_date: form.start_date || today(),
      target_amount: amountString(form.target_amount, decimals) || "0",
      target_date: form.target_date || null,
      transaction_currency_code:
        form.currency_code === initial?.currency_code
          ? undefined
          : form.currency_code,
    };
  }

  async function save() {
    let id = piggy?.id;
    const ok = await action.run(async () => {
      const saved = await api<One<PiggyBank>>(
        piggy ? `/v1/piggy-banks/${piggy.id}` : "/v1/piggy-banks",
        { body: body(), method: piggy ? "PUT" : "POST" }
      );
      ({ id } = saved.data);
    });
    if (ok) {
      await invalidate();
      await goto(`/piggy-banks/show/${id}`);
    }
  }

  async function remove() {
    if (!piggy) {
      return;
    }
    const ok = await action.run(() =>
      api(`/v1/piggy-banks/${piggy.id}`, { method: "DELETE" })
    );
    if (ok) {
      await goto("/piggy-banks");
      await invalidate();
    }
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: piggy ? "Update piggy bank" : "Store new piggy bank",
      run: save,
    },
  ]);
</script>

<form
  class="flex flex-col gap-3"
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <div class="grid items-start gap-3 lg:grid-cols-2">
    <Box body="flex flex-col gap-3 p-4" title="Mandatory fields">
      <Field for="piggy-name" label="Name" problem={action.field("name")}>
        <Input id="piggy-name" required bind:value={form.name} />
      </Field>
      <Field
        for="piggy-target"
        help="Leave empty to save without a target."
        label="Target amount"
        problem={action.field("target_amount")}
      >
        <Input
          class="num"
          id="piggy-target"
          inputmode="decimal"
          bind:value={form.target_amount}
        />
      </Field>
      <Field
        for="piggy-currency"
        help="Piggy banks can only save money in a single currency."
        label="Currency"
        problem={action.field("transaction_currency_code")}
      >
        <select
          class={select}
          id="piggy-currency"
          bind:value={form.currency_code}
        >
          {#each currencies as currency (currency.id)}
            <option value={currency.attributes.code}>
              {currency.attributes.name}
              ({currency.attributes.symbol})
            </option>
          {/each}
        </select>
      </Field>
      <Field
        help="Only accounts in the selected currency are listed. The amount is what this piggy bank holds on each account."
        label="Save on account(s)"
        problem={action.field("accounts") ??
          Object.entries(action.errors).find(([k]) =>
            k.startsWith("accounts.")
          )?.[1][0]}
      >
        <div
          class="cladd-cut flex max-h-64 flex-col overflow-y-auto rounded-cladd-md py-1"
        >
          {#each accounts as account (account.id)}
            {@const on = account.id in linked}
            <div class="flex h-8 items-center gap-2 px-2.5">
              <label class="flex min-w-0 flex-1 items-center gap-2">
                <input
                  checked={on}
                  class="size-4 accent-(--ff-brand)"
                  onchange={(e) => toggle(account.id, e.currentTarget.checked)}
                  type="checkbox"
                >
                <span class="truncate">{account.attributes.name}</span>
                <span class="text-[12px] text-cladd-fg-softer"
                  >{account.attributes.currency_code}</span
                >
              </label>
              {#if on}
                <Input
                  aria-label="Saved on {account.attributes.name}"
                  class="num h-7 w-28"
                  inputmode="decimal"
                  bind:value={linked[account.id]}
                />
              {/if}
            </div>
          {:else}
            <p class="px-2.5 py-1.5 text-cladd-fg-soft">
              {assets.isPending
                ? "Loading accounts"
                : "No asset account or liability uses this currency."}
            </p>
          {/each}
        </div>
      </Field>
    </Box>
    <Box body="flex flex-col gap-3 p-4" title="Optional fields">
      {#if piggy}
        <Field
          for="piggy-start"
          label="Start date"
          problem={action.field("start_date")}
        >
          <Input id="piggy-start" type="date" bind:value={form.start_date} />
        </Field>
      {/if}
      <Field
        for="piggy-target-date"
        label="Target date"
        problem={action.field("target_date")}
      >
        <Input
          id="piggy-target-date"
          type="date"
          bind:value={form.target_date}
        />
      </Field>
      <Field
        for="piggy-group"
        label="Group"
        problem={action.field("object_group_title")}
      >
        <GroupInput id="piggy-group" bind:value={form.object_group_title} />
      </Field>
      <Field for="piggy-notes" label="Notes" problem={action.field("notes")}>
        <textarea
          class={textarea}
          id="piggy-notes"
          rows="4"
          bind:value={form.notes}
        ></textarea>
      </Field>
    </Box>
  </div>
  <div class="flex flex-wrap items-center gap-3">
    <Button disabled={action.busy} type="submit">
      {piggy ? "Update piggy bank" : "Store new piggy bank"}
      <span class="kbd">{prettyKeys("mod+Enter")[0]}</span>
    </Button>
    <Status {action} />
    {#if piggy}
      <ConfirmButton class="ms-auto" onconfirm={remove}>Delete</ConfirmButton>
    {/if}
  </div>
</form>
