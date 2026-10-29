<script lang="ts">
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Bill, Item, One } from "#lib/api/types.js";
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
  import { FREQUENCIES, FREQUENCY_LABELS } from "./bills.js";

  let { bill }: { bill?: Item<Bill> } = $props();

  const initial = untrack(() => bill?.attributes);
  const form = $state({
    active: initial?.active ?? true,
    amount_max: initial?.amount_max ?? "",
    amount_min: initial?.amount_min ?? "",
    currency_code: initial?.currency_code ?? session.primary?.code ?? "",
    date: initial?.date?.slice(0, 10) ?? today(),
    end_date: initial?.end_date?.slice(0, 10) ?? "",
    extension_date: initial?.extension_date?.slice(0, 10) ?? "",
    name: initial?.name ?? "",
    notes: initial?.notes ?? "",
    object_group_title: initial?.object_group_title ?? "",
    repeat_freq: initial?.repeat_freq ?? "monthly",
    skip: String(initial?.skip ?? 0),
  });

  const action = new Action();
  const currencies = $derived(
    session.currencies.filter(
      (c) => c.attributes.enabled || c.attributes.code === form.currency_code
    )
  );
  const decimals = $derived(
    currencies.find((c) => c.attributes.code === form.currency_code)?.attributes
      .decimal_places ?? 2
  );

  function body() {
    const min = amountString(form.amount_min, decimals);
    return {
      active: form.active,
      amount_max: amountString(form.amount_max, decimals) || min,
      amount_min: min,
      currency_code:
        form.currency_code === initial?.currency_code
          ? undefined
          : form.currency_code,
      date: form.date,
      end_date: form.end_date || undefined,
      extension_date: form.extension_date || undefined,
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      object_group_title:
        form.object_group_title.trim() || (bill ? "" : undefined),
      repeat_freq: form.repeat_freq,
      skip: Number(form.skip) || 0,
    };
  }

  async function save() {
    let id = bill?.id;
    const ok = await action.run(async () => {
      const saved = await api<One<Bill>>(
        bill ? `/v1/bills/${bill.id}` : "/v1/bills",
        { body: body(), method: bill ? "PUT" : "POST" }
      );
      ({ id } = saved.data);
    });
    if (ok) {
      await invalidate();
      await goto(`/subscriptions/show/${id}`);
    }
  }

  async function remove() {
    if (!bill) {
      return;
    }
    const ok = await action.run(() =>
      api(`/v1/bills/${bill.id}`, { method: "DELETE" })
    );
    if (ok) {
      await goto("/subscriptions");
      await invalidate();
    }
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: bill ? "Update subscription" : "Store new subscription",
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
      <Field for="bill-name" label="Name" problem={action.field("name")}>
        <Input id="bill-name" required bind:value={form.name} />
      </Field>
      <Field
        for="bill-currency"
        label="Currency"
        problem={action.field("currency_code") ?? action.field("currency_id")}
      >
        <select
          class={select}
          id="bill-currency"
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
        for="bill-min"
        label="Minimum amount"
        problem={action.field("amount_min")}
      >
        <Input
          class="num"
          id="bill-min"
          inputmode="decimal"
          required
          bind:value={form.amount_min}
        />
      </Field>
      <Field
        for="bill-max"
        help="Leave empty when the amount is always the same."
        label="Maximum amount"
        problem={action.field("amount_max")}
      >
        <Input
          class="num"
          id="bill-max"
          inputmode="decimal"
          bind:value={form.amount_max}
        />
      </Field>
      <Field
        for="bill-date"
        help="The first date this subscription is expected."
        label="Date"
        problem={action.field("date")}
      >
        <Input id="bill-date" required type="date" bind:value={form.date} />
      </Field>
      <Field
        for="bill-repeat"
        label="Repeats"
        problem={action.field("repeat_freq")}
      >
        <select class={select} id="bill-repeat" bind:value={form.repeat_freq}>
          {#each FREQUENCIES as frequency (frequency)}
            <option value={frequency}>{FREQUENCY_LABELS[frequency]}</option>
          {/each}
        </select>
      </Field>
      <Field
        for="bill-skip"
        help="Skip 1 with monthly means every other month."
        label="Skip"
        problem={action.field("skip")}
      >
        <Input
          class="num w-24"
          id="bill-skip"
          max="31"
          min="0"
          type="number"
          bind:value={form.skip}
        />
      </Field>
    </Box>
    <Box body="flex flex-col gap-3 p-4" title="Optional fields">
      <Field
        for="bill-end"
        help="The subscription stops being expected after this date."
        label="End date"
        problem={action.field("end_date")}
      >
        <Input id="bill-end" type="date" bind:value={form.end_date} />
      </Field>
      <Field
        for="bill-extension"
        help="The date to extend or cancel the subscription."
        label="Extension date"
        problem={action.field("extension_date")}
      >
        <Input
          id="bill-extension"
          type="date"
          bind:value={form.extension_date}
        />
      </Field>
      <Field
        for="bill-group"
        label="Group"
        problem={action.field("object_group_title")}
      >
        <GroupInput id="bill-group" bind:value={form.object_group_title} />
      </Field>
      <Field for="bill-notes" label="Notes" problem={action.field("notes")}>
        <textarea
          class={textarea}
          id="bill-notes"
          rows="4"
          bind:value={form.notes}
        ></textarea>
      </Field>
      {#if bill}
        <Field for="bill-active" label="Active">
          <input
            class="mt-2 size-4 accent-(--ff-brand)"
            id="bill-active"
            type="checkbox"
            bind:checked={form.active}
          >
        </Field>
      {/if}
    </Box>
  </div>
  <div class="flex flex-wrap items-center gap-3">
    <Button disabled={action.busy} type="submit">
      {bill ? "Update subscription" : "Store new subscription"}
      <span class="kbd">{prettyKeys("mod+Enter")[0]}</span>
    </Button>
    <Status {action} />
    {#if bill}
      <ConfirmButton class="ms-auto" onconfirm={remove}>Delete</ConfirmButton>
    {/if}
  </div>
</form>
