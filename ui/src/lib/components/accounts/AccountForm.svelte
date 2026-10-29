<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type {
    Account,
    AccountType,
    Item,
    One,
    Page,
    PiggyBank,
  } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import {
    fieldErrors,
    SELECT_CLASS,
  } from "#lib/components/categories/form.js";
  import DateInput from "#lib/components/inputs/DateInput.svelte";
  import Field from "#lib/components/inputs/Field.svelte";
  import { INPUT } from "#lib/components/inputs/styles.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Textarea } from "#lib/components/ui/textarea/index.js";
  import { today } from "#lib/dates.js";
  import { toNumber } from "#lib/format.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";
  import {
    indexUrl,
    LIABILITY_LABEL,
    ROLE_LABEL,
    showUrl,
    TYPE_ONE,
  } from "./links.js";

  const DIRECTIONS = [
    { label: "I owe this debt to somebody else", value: "debit" },
    { label: "I am owed this debt", value: "credit" },
  ];
  const PERIODS = [
    { label: "Per day", value: "daily" },
    { label: "Per week", value: "weekly" },
    { label: "Per month", value: "monthly" },
    { label: "Per quarter", value: "quarterly" },
    { label: "Per half year", value: "half-year" },
    { label: "Per year", value: "yearly" },
  ];
  const CHECKBOX = "size-4 accent-[var(--ff-brand)]";

  let { type, account }: { type: AccountType; account?: Item<Account> } =
    $props();

  const initial = untrack(() => account)?.attributes;
  const blank = (value: string | null | undefined) => value ?? "";
  const positive = (value: string | null | undefined) =>
    value ? String(Math.abs(toNumber(value))) : "";

  let name = $state(blank(initial?.name));
  let currency = $state(initial?.currency_code ?? session.primary?.code ?? "");
  let role = $state<string>(initial?.account_role ?? "defaultAsset");
  let liabilityType = $state<string>(initial?.liability_type ?? "debt");
  let direction = $state<string>(initial?.liability_direction ?? "debit");
  let interest = $state(blank(initial?.interest) || "0");
  let interestPeriod = $state<string>(initial?.interest_period ?? "monthly");
  let iban = $state(blank(initial?.iban));
  let bic = $state(blank(initial?.bic));
  let number = $state(blank(initial?.account_number));
  let opening = $state(
    untrack(() => type) === "liabilities"
      ? positive(initial?.opening_balance)
      : blank(initial?.opening_balance)
  );
  let openingDate = $state(
    blank(initial?.opening_balance_date).slice(0, 10) || today()
  );
  let virtualBalance = $state(blank(initial?.virtual_balance));
  let netWorth = $state(initial?.include_net_worth ?? true);
  let notes = $state(blank(initial?.notes));
  let active = $state(initial?.active ?? true);
  let cardType = $state(initial?.credit_card_type ?? "monthlyFull");
  let paymentDate = $state(
    blank(initial?.monthly_payment_date).slice(0, 10) || today()
  );
  let again = $state(false);
  let nameInput = $state<HTMLInputElement>();
  let errors = $state<Record<string, string>>({});
  let busy = $state(false);
  let saved = $state("");

  const piggies = createQuery(() => ({
    enabled: Boolean(account),
    queryFn: () =>
      api<Page<PiggyBank>>(`/v1/accounts/${account?.id}/piggy-banks`, {
        query: { limit: 1 },
      }),
    queryKey: ["account-piggies", account?.id],
  }));
  const locked = $derived((piggies.data?.meta.pagination?.total ?? 0) > 0);
  const enabled = $derived(
    session.currencies.filter(
      (c) => c.attributes.enabled || c.attributes.code === currency
    )
  );
  const hasCurrency = $derived(type === "asset" || type === "liabilities");
  const isCard = $derived(type === "asset" && role === "ccAsset");
  const openingLabel = $derived(
    direction === "credit" ? "I am owed amount" : "I owe amount"
  );
  const submitLabel = $derived(
    `${account ? "Update" : "Store new"} ${TYPE_ONE[type]}`
  );

  function assetFields(): Record<string, unknown> {
    return {
      account_role: role,
      virtual_balance: virtualBalance || null,
      ...(isCard
        ? { credit_card_type: cardType, monthly_payment_date: paymentDate }
        : {}),
    };
  }

  function liabilityFields(): Record<string, unknown> {
    return {
      interest: interest || "0",
      interest_period: interestPeriod,
      liability_direction: direction,
      liability_type: liabilityType,
      ...(account && opening !== ""
        ? { liability_amount: opening, liability_start_date: openingDate }
        : {}),
    };
  }

  function body(): Record<string, unknown> {
    const hasOpening = opening !== "";
    return {
      account_number: number || null,
      bic: bic || null,
      iban: iban || null,
      name,
      notes: notes || null,
      type,
      ...(account ? { active } : {}),
      ...(hasCurrency
        ? { currency_code: currency, include_net_worth: netWorth }
        : {}),
      ...(hasOpening || account
        ? {
            opening_balance: hasOpening ? opening : null,
            opening_balance_date: hasOpening ? openingDate : null,
          }
        : {}),
      ...(type === "asset" ? assetFields() : {}),
      ...(type === "liabilities" ? liabilityFields() : {}),
    };
  }

  async function addToFrontpage(id: string) {
    const ids = session.frontpageAccounts;
    if (!("frontpageAccounts" in session.prefs) || ids.includes(id)) {
      return;
    }
    await session.setPreference("frontpageAccounts", [...ids, id].map(Number));
  }

  function reset() {
    name = "";
    iban = "";
    bic = "";
    number = "";
    opening = "";
    virtualBalance = "";
    notes = "";
  }

  async function save(event?: Event) {
    event?.preventDefault();
    if (busy) {
      return;
    }
    busy = true;
    errors = {};
    saved = "";
    try {
      const result = await api<One<Account>>(
        account ? `/v1/accounts/${account.id}` : "/v1/accounts",
        { body: body(), method: account ? "PUT" : "POST" }
      );
      if (!account && type === "asset") {
        await addToFrontpage(result.data.id);
      }
      await invalidate();
      if (again) {
        saved = `Saved ${result.data.attributes.name}`;
        if (!account) {
          reset();
        }
        return;
      }
      await goto(showUrl(result.data.id));
    } catch (failure) {
      errors = fieldErrors(failure);
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!account) {
      return;
    }
    try {
      await api(`/v1/accounts/${account.id}`, { method: "DELETE" });
      await invalidate();
      await goto(indexUrl(type));
    } catch (failure) {
      errors = fieldErrors(failure);
    }
  }

  $effect(() => {
    if (!untrack(() => account)) {
      nameInput?.focus();
    }
  });

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: submitLabel,
      run: () => save(),
    },
  ]);
</script>

<form class="flex flex-col gap-3" onsubmit={save}>
  <div class="grid gap-3 lg:grid-cols-2">
    <Box body="flex flex-col gap-3 p-3" title="Mandatory fields">
      <Field error={errors.name} for="name" label="Name">
        <input
          autocomplete="off"
          class={INPUT}
          id="name"
          required
          bind:this={nameInput}
          bind:value={name}
        >
      </Field>
      {#if hasCurrency}
        <Field
          error={errors.currency_code ?? errors.currency_id}
          for="currency"
          label="Currency"
        >
          {#if locked}
            <p class="py-1.5 text-cladd-fg">
              {currency}
              <span class="text-cladd-fg-soft"
                >· piggy banks are linked, so the currency stays</span
              >
            </p>
          {:else}
            <select class={SELECT_CLASS} id="currency" bind:value={currency}>
              {#each enabled as cur (cur.id)}
                <option value={cur.attributes.code}>
                  {cur.attributes.name}
                  ({cur.attributes.symbol})
                </option>
              {/each}
            </select>
          {/if}
        </Field>
      {/if}
      {#if type === "asset"}
        <Field error={errors.account_role} for="role" label="Account role">
          <select class={SELECT_CLASS} id="role" bind:value={role}>
            {#each Object.entries(ROLE_LABEL) as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
        </Field>
      {/if}
      {#if type === "liabilities"}
        <Field
          error={errors.liability_type}
          for="liability-type"
          label="Liability type"
        >
          <select
            class={SELECT_CLASS}
            id="liability-type"
            bind:value={liabilityType}
          >
            {#each Object.entries(LIABILITY_LABEL) as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
        </Field>
        <Field
          error={errors.liability_direction}
          for="direction"
          label="Liability in/out"
        >
          <select class={SELECT_CLASS} id="direction" bind:value={direction}>
            {#each DIRECTIONS as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </Field>
        <div class="grid gap-3 sm:grid-cols-2">
          <Field
            error={errors.opening_balance ?? errors.liability_amount}
            for="opening"
            label={openingLabel}
          >
            <input
              class="{INPUT} num text-right"
              id="opening"
              inputmode="decimal"
              bind:value={opening}
            >
          </Field>
          <Field
            error={errors.opening_balance_date ?? errors.liability_start_date}
            for="opening-date"
            label="Start date of debt"
          >
            <DateInput id="opening-date" bind:value={openingDate} />
          </Field>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <Field error={errors.interest} for="interest" label="Interest (%)">
            <input
              class="{INPUT} num text-right"
              id="interest"
              inputmode="decimal"
              bind:value={interest}
            >
          </Field>
          <Field
            error={errors.interest_period}
            for="interest-period"
            label="Interest period"
          >
            <select
              class={SELECT_CLASS}
              id="interest-period"
              bind:value={interestPeriod}
            >
              {#each PERIODS as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </Field>
        </div>
      {/if}
    </Box>
    <Box body="flex flex-col gap-3 p-3" title="Optional fields">
      <div class="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field error={errors.iban} for="iban" label="IBAN">
          <input
            autocomplete="off"
            class="{INPUT} num"
            id="iban"
            bind:value={iban}
          >
        </Field>
        <Field error={errors.bic} for="bic" label="BIC">
          <input
            autocomplete="off"
            class="{INPUT} num"
            id="bic"
            maxlength="11"
            bind:value={bic}
          >
        </Field>
      </div>
      <Field
        error={errors.account_number}
        for="number"
        label={isCard ? "Credit card number" : "Account number"}
      >
        <input
          autocomplete="off"
          class="{INPUT} num"
          id="number"
          bind:value={number}
        >
      </Field>
      {#if type === "asset"}
        <div class="grid gap-3 sm:grid-cols-2">
          <Field
            error={errors.opening_balance}
            for="opening"
            label="Opening balance"
          >
            <input
              class="{INPUT} num text-right"
              id="opening"
              inputmode="decimal"
              bind:value={opening}
            >
          </Field>
          <Field
            error={errors.opening_balance_date}
            for="opening-date"
            label="Opening balance date"
          >
            <DateInput id="opening-date" bind:value={openingDate} />
          </Field>
        </div>
        <Field
          error={errors.virtual_balance}
          for="virtual"
          label="Virtual balance"
        >
          <input
            class="{INPUT} num text-right"
            id="virtual"
            inputmode="decimal"
            bind:value={virtualBalance}
          >
        </Field>
      {/if}
      {#if hasCurrency}
        <label class="flex items-center gap-2 text-[13px]">
          <input class={CHECKBOX} type="checkbox" bind:checked={netWorth}>
          Include in net worth
        </label>
      {/if}
      {#if account}
        <label class="flex items-center gap-2 text-[13px]">
          <input class={CHECKBOX} type="checkbox" bind:checked={active}>
          Active
        </label>
      {/if}
      <Field error={errors.notes} for="notes" label="Notes">
        <Textarea id="notes" rows={4} bind:value={notes} />
      </Field>
    </Box>
  </div>

  {#if isCard}
    <div class="grid gap-3 lg:grid-cols-2">
      <span class="hidden lg:block"></span>
      <Box body="flex flex-col gap-3 p-3" title="Credit card options">
        <Field
          error={errors.credit_card_type}
          for="card-type"
          label="Credit card payment plan"
        >
          <select class={SELECT_CLASS} id="card-type" bind:value={cardType}>
            <option value="monthlyFull">Full payment every month</option>
          </select>
        </Field>
        <Field
          error={errors.monthly_payment_date}
          for="payment-date"
          label="Credit card monthly payment date"
        >
          <DateInput id="payment-date" bind:value={paymentDate} />
        </Field>
      </Box>
    </div>
  {/if}

  <Box body="flex flex-wrap items-center gap-3 p-3" title="Options">
    <Button disabled={busy} type="submit">{submitLabel}</Button>
    <span class="flex gap-1 text-[12px] text-cladd-fg-soft">
      {#each prettyKeys("mod+Enter") as key (key)}
        <span class="kbd">{key}</span>
      {/each}
    </span>
    <label class="flex items-center gap-2 text-[13px]">
      <input class={CHECKBOX} type="checkbox" bind:checked={again}>
      {account
        ? "Return here after updating"
        : "Return here to create another one"}
    </label>
    {#if busy}
      <span class="text-[12px] text-cladd-fg-soft">Saving</span>
    {:else if errors.form}
      <span class="text-[12px] text-expense" role="alert">{errors.form}</span>
    {:else if saved}
      <span class="text-[12px] text-income" role="status">{saved}</span>
    {:else if Object.keys(errors).length > 0}
      <span class="text-[12px] text-expense" role="alert"
        >Some fields need fixing</span
      >
    {/if}
    {#if account}
      <span class="ml-auto">
        <ConfirmButton
          confirmLabel="Press again: delete with its transactions"
          onconfirm={remove}
          >Delete</ConfirmButton
        >
      </span>
    {/if}
  </Box>
</form>
