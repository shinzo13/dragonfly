<script lang="ts">
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Budget, Item, One } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import Field from "#lib/components/categories/Field.svelte";
  import {
    fieldErrors,
    SELECT_CLASS,
  } from "#lib/components/categories/form.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { Textarea } from "#lib/components/ui/textarea/index.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";

  const TYPES = [
    { label: "No auto-budget", value: "none" },
    { label: "Set a fixed amount every period", value: "reset" },
    { label: "Add an amount every period", value: "rollover" },
    {
      label: "Add an amount every period and correct for overspending",
      value: "adjusted",
    },
  ];
  const PERIODS = [
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
    { label: "Quarterly", value: "quarterly" },
    { label: "Every half year", value: "half_year" },
    { label: "Yearly", value: "yearly" },
  ];

  let { budget }: { budget?: Item<Budget> } = $props();

  const initial = untrack(() => budget)?.attributes;
  let name = $state(initial?.name ?? "");
  let active = $state(initial?.active ?? true);
  let autoType = $state<string>(initial?.auto_budget_type ?? "none");
  let currency = $state(
    initial?.currency_code ?? session.primary?.code ?? "EUR"
  );
  let autoAmount = $state(initial?.auto_budget_amount ?? "");
  let autoPeriod = $state<string>(initial?.auto_budget_period ?? "monthly");
  let notes = $state(initial?.notes ?? "");
  let errors = $state<Record<string, string>>({});
  let busy = $state(false);
  let armed = $state(false);

  const enabled = $derived(
    session.currencies.filter((c) => c.attributes.enabled)
  );

  async function save(event?: Event) {
    event?.preventDefault();
    if (busy) {
      return;
    }
    busy = true;
    errors = {};
    const auto =
      autoType === "none"
        ? { auto_budget_type: "none" }
        : {
            auto_budget_amount: autoAmount,
            auto_budget_currency_code: currency,
            auto_budget_period: autoPeriod,
            auto_budget_type: autoType,
          };
    const body = budget
      ? { active, name, notes: notes || null, ...auto }
      : { name, ...auto };
    try {
      const saved = await api<One<Budget>>(
        budget ? `/v1/budgets/${budget.id}` : "/v1/budgets",
        { body, method: budget ? "PUT" : "POST" }
      );
      await invalidate();
      await goto(`/budgets/show/${saved.data.id}`);
    } catch (failure) {
      errors = fieldErrors(failure);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!budget) {
      return;
    }
    await api(`/v1/budgets/${budget.id}`, { method: "DELETE" });
    await invalidate();
    await goto("/budgets");
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: budget ? "Update budget" : "Store new budget",
      run: () => save(),
    },
  ]);
</script>

<form class="flex flex-col gap-4" onsubmit={save}>
  <div class="grid gap-4 lg:grid-cols-2">
    <Box title="Mandatory fields">
      <Field id="name" issue={errors.name} label="Name">
        <Input autofocus id="name" required bind:value={name} />
      </Field>
      {#if budget}
        <Field id="active" issue={errors.active} label="Active">
          <input
            class="mt-1.5 size-4 accent-brand"
            id="active"
            type="checkbox"
            bind:checked={active}
          >
        </Field>
      {/if}
    </Box>
    <Box title="Optional fields">
      <Field id="auto-type" issue={errors.auto_budget_type} label="Auto-budget">
        <select class={SELECT_CLASS} id="auto-type" bind:value={autoType}>
          {#each TYPES as type (type.value)}
            <option value={type.value}>{type.label}</option>
          {/each}
        </select>
      </Field>
      {#if autoType !== "none"}
        <Field
          id="currency"
          issue={errors.auto_budget_currency_code ?? errors.currency_code}
          label="Currency"
        >
          <select class={SELECT_CLASS} id="currency" bind:value={currency}>
            {#each enabled as cur (cur.id)}
              <option value={cur.attributes.code}>
                {cur.attributes.name}
                ({cur.attributes.symbol})
              </option>
            {/each}
          </select>
        </Field>
        <Field
          id="auto-amount"
          issue={errors.auto_budget_amount}
          label="Auto-budget amount"
        >
          <Input
            class="num"
            id="auto-amount"
            inputmode="decimal"
            bind:value={autoAmount}
          />
        </Field>
        <Field
          id="auto-period"
          issue={errors.auto_budget_period}
          label="Auto-budget period"
        >
          <select class={SELECT_CLASS} id="auto-period" bind:value={autoPeriod}>
            {#each PERIODS as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </Field>
      {/if}
      {#if budget}
        <Field id="notes" issue={errors.notes} label="Notes">
          <Textarea id="notes" rows={4} bind:value={notes} />
        </Field>
      {/if}
    </Box>
  </div>
  <div class="flex items-center gap-3">
    <Button disabled={busy} type="submit">
      {budget ? "Update budget" : "Store new budget"}
    </Button>
    <span class="flex gap-1 text-[12px] text-cladd-fg-soft">
      {#each prettyKeys("mod+Enter") as key (key)}
        <span class="kbd">{key}</span>
      {/each}
    </span>
    {#if busy}
      <span class="text-[12px] text-cladd-fg-soft">Saving</span>
    {:else if errors.form}
      <span class="text-[12px] text-expense">{errors.form}</span>
    {/if}
    {#if budget}
      <span class="ml-auto text-[12px] text-cladd-fg-soft">
        {#if armed}
          Its transactions stay, without a budget.
        {/if}
      </span>
      <ConfirmButton onconfirm={remove} bind:armed>Delete budget</ConfirmButton>
    {/if}
  </div>
</form>
