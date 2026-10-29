<script lang="ts">
  import Trash from "@lucide/svelte/icons/trash-2";
  import type { Split } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import AmountInput from "#lib/components/inputs/AmountInput.svelte";
  import AutocompleteInput from "#lib/components/inputs/AutocompleteInput.svelte";
  import DateInput from "#lib/components/inputs/DateInput.svelte";
  import Field from "#lib/components/inputs/Field.svelte";
  import { INPUT } from "#lib/components/inputs/styles.js";
  import TagsInput from "#lib/components/inputs/TagsInput.svelte";
  import { session } from "#lib/session.svelte.js";
  import AccountField from "./AccountField.svelte";
  import type { Catalog } from "./catalog.svelte.js";
  import {
    type AccountRef,
    CASH,
    type Cur,
    type Errors,
    emptyAccount,
    emptyRef,
    type Form,
    FREE_KIND,
    fieldError,
    hasForeign,
    KINDS,
    META_DATE_LABEL,
    META_DATES,
    SHARED,
    type Side,
    toAccountRef,
  } from "./model.js";
  import RefField from "./RefField.svelte";

  let {
    form = $bindable(),
    index,
    catalog,
    errors,
    create,
    onremove,
  }: {
    form: Form;
    index: number;
    catalog: Catalog;
    errors: Errors;
    create: boolean;
    onremove: () => void;
  } = $props();

  const split = $derived(form.splits[index]);
  const count = $derived(form.splits.length);
  const first = $derived(index === 0);
  const id = (field: string) => `f-${split.key}-${field}`;
  const err = (field: string) => fieldError(errors, index, field);
  const keyHint = (keys: string) => (first ? keys : "");
  const withdrawal = $derived(form.type === "withdrawal");
  const counterparty = $derived<Side | null>(
    { deposit: "source", transfer: null, withdrawal: "destination" }[
      form.type
    ] as Side | null
  );

  const optionalPref = $derived(
    (session.prefs.transaction_journal_optional_fields ?? {}) as Record<
      string,
      boolean
    >
  );
  let more = $state(false);
  const showExtra = (key: string, value: string) =>
    more || Boolean(value) || optionalPref[key] === true;

  let filled = $state<{ text: string; undo: () => void } | null>(null);

  function fill(past: Split, withCounterparty: boolean) {
    const parts: string[] = [];
    const undo: (() => void)[] = [];
    const put = (text: string, still: () => boolean, clear: () => void) => {
      parts.push(text);
      undo.push(() => {
        if (still()) {
          clear();
        }
      });
    };
    const putRef = (field: "bill" | "budget", refId: string, name: string) => {
      if (withdrawal && !(split[field].id || split[field].name)) {
        split[field] = { id: refId, name };
        put(
          `${field === "bill" ? "subscription" : field} ${name}`,
          () => split[field].id === refId,
          () => {
            split[field] = emptyRef();
          }
        );
      }
    };
    const side = counterparty;
    if (withCounterparty && side && past.type === form.type) {
      const pastId = past[`${side}_id`];
      const current = split[side];
      const account = pastId ? catalog.accountById(pastId) : undefined;
      if (
        account &&
        past[`${side}_type`] !== CASH &&
        !(current.id || current.name.trim())
      ) {
        const next = toAccountRef(account);
        split[side] = next;
        put(
          next.name,
          () => split[side].id === next.id,
          () => {
            split[side] = emptyAccount();
          }
        );
      }
    }
    const category = past.category_name ?? "";
    if (category && !split.category.trim()) {
      split.category = category;
      put(
        `category ${category}`,
        () => split.category === category,
        () => {
          split.category = "";
        }
      );
    }
    if (past.budget_id) {
      putRef("budget", past.budget_id, past.budget_name ?? "");
    }
    const bill = withCounterparty ? catalog.billById(past.bill_id) : undefined;
    if (bill) {
      putRef("bill", bill.id, bill.attributes.name ?? "");
    }
    if (parts.length) {
      filled = {
        text: parts.join(", "),
        undo: () => {
          for (const step of undo) {
            step();
          }
          filled = null;
        },
      };
    }
  }

  async function pickedAccount(side: Side, value: AccountRef) {
    if (side !== counterparty || !value.id) {
      return;
    }
    const past = await catalog.lastFor(value.id, side, form.type);
    if (past) {
      fill(past.split, false);
    }
  }

  async function pickedDescription(journalId: unknown) {
    if (typeof journalId !== "string" || !journalId) {
      return;
    }
    const past = await catalog.fromJournal(journalId);
    if (past) {
      fill(past.split, true);
    }
  }

  const placeholder = (side: Side) =>
    FREE_KIND[form.type][side] ? "(cash) or a new name" : "";

  const sharedName = (side: Side) =>
    form.splits[0][side].name || (FREE_KIND[form.type][side] ? "(cash)" : "");

  const transferForeign = $derived(
    form.type === "transfer" && hasForeign(split)
  );
</script>

{#snippet account(
  side: Side,
  label: string,
  keys: string
)}
  <Field error={err(side)} for={id(side)} keys={keyHint(keys)} {label}>
    {#if !first && SHARED[form.type][side]}
      <p
        class="flex h-9 items-center truncate text-[13px] text-cladd-fg-soft sm:h-cladd-md"
        id={id(side)}
      >
        {sharedName(side) || "Same as split 1"}
        <span class="ml-1 text-cladd-fg-softer">(same for all splits)</span>
      </p>
    {:else}
      <AccountField
        {catalog}
        disabled={split.reconciled}
        free={Boolean(FREE_KIND[form.type][side])}
        id={id(side)}
        invalid={Boolean(err(side))}
        kinds={KINDS[form.type][side]}
        onpick={(value) => pickedAccount(side, value)}
        placeholder={placeholder(side)}
        bind:value={split[side]}
      />
    {/if}
  </Field>
{/snippet}

<Box
  body="p-3 sm:p-4"
  title={count > 1
    ? `Split ${index + 1} / ${count}`
    : "Transaction information"}
>
  {#snippet tools()}
    {#if count > 1}
      <button
        class="inline-flex h-7 items-center gap-1.5 rounded-cladd-sm px-2 text-[12px] text-cladd-fg-soft hover:bg-cladd-surface-next hover:text-expense"
        onclick={onremove}
        type="button"
      >
        <Trash class="size-3.5" />
        Remove split
        <span class="kbd hidden lg:inline-flex">X</span>
      </button>
    {/if}
  {/snippet}
  <div class="grid gap-x-6 gap-y-3 lg:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-3">
      <Field
        error={err("description")}
        for={id("description")}
        keys={keyHint("d")}
        label="Description"
      >
        <AutocompleteInput
          async
          free
          id={id("description")}
          invalid={Boolean(err("description"))}
          onpick={(option) => pickedDescription(option.data)}
          search={catalog.descriptionOptions}
          bind:value={split.description}
        />
      </Field>
      {@render account("source", "Source account", "f")}
      {@render account("destination", "Destination account", "t")}
      {#if first}
        <Field error={err("date")} for={id("date")} keys="w" label="Date">
          <DateInput
            id={id("date")}
            invalid={Boolean(err("date"))}
            placeholder="today, -1, 14.10"
            bind:value={form.date}
          />
        </Field>
      {/if}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          error={err("amount")}
          for={id("amount")}
          keys={keyHint("m")}
          label="Amount"
        >
          <AmountInput
            currency={split.currency?.code ?? ""}
            decimals={split.currency?.decimals ?? 2}
            disabled={split.reconciled}
            id={id("amount")}
            invalid={Boolean(err("amount"))}
            placeholder="0.00 or 12.5+3"
            bind:value={split.amount}
          />
        </Field>
        {#if transferForeign}
          <Field
            error={err("foreign_amount")}
            for={id("foreign-amount")}
            label="Amount in {form.splits[0].destination.name ||
              split.foreignCurrency?.code}"
          >
            <AmountInput
              currency={split.foreignCurrency?.code ?? ""}
              decimals={split.foreignCurrency?.decimals ?? 2}
              disabled={split.reconciled}
              id={id("foreign-amount")}
              invalid={Boolean(err("foreign_amount"))}
              bind:value={split.foreignAmount}
            />
          </Field>
        {:else if form.type !== "transfer"}
          <Field
            error={err("foreign_amount") || err("foreign_currency_code")}
            for={id("foreign-currency")}
            label="Foreign amount"
          >
            <div class="flex gap-1.5">
              <AutocompleteInput
                class="w-20 shrink-0"
                disabled={split.reconciled}
                id={id("foreign-currency")}
                invalid={Boolean(err("foreign_currency_code"))}
                onpick={(option) =>
                  (split.foreignCurrency = option.data as Cur)}
                placeholder="Cur."
                search={catalog.currencyOptions}
                bind:value={
                  () => split.foreignCurrency?.code ?? "",
                  (text) => {
    if (!text.trim()) {
      split.foreignCurrency = null;
    }
  }
                }
              />
              {#if hasForeign(split)}
                <AmountInput
                  class="min-w-0 flex-1"
                  currency={split.foreignCurrency?.code ?? ""}
                  decimals={split.foreignCurrency?.decimals ?? 2}
                  disabled={split.reconciled}
                  id={id("foreign-amount")}
                  invalid={Boolean(err("foreign_amount"))}
                  bind:value={split.foreignAmount}
                />
              {/if}
            </div>
          </Field>
        {/if}
      </div>
      {#if split.reconciled}
        <p class="text-[12px] text-warn">
          This split is reconciled, so its amount and accounts are locked.
        </p>
      {/if}
    </div>

    <div
      class="flex min-w-0 flex-col gap-3 border-cladd-outline lg:border-l lg:pl-6"
    >
      {#if withdrawal}
        <Field
          error={err("budget_id")}
          for={id("budget")}
          keys={keyHint("b")}
          label="Budget"
        >
          <RefField
            id={id("budget")}
            invalid={Boolean(err("budget_id"))}
            placeholder="(no budget)"
            search={catalog.budgetOptions}
            bind:value={split.budget}
          />
        </Field>
      {/if}
      <Field
        error={err("category_name")}
        for={id("category")}
        keys={keyHint("c")}
        label="Category"
      >
        <AutocompleteInput
          free
          id={id("category")}
          invalid={Boolean(err("category_name"))}
          openOnFocus
          search={catalog.categoryOptions}
          bind:value={split.category}
        />
      </Field>
      {#if filled}
        <p class="-mt-1.5 text-[12px] text-cladd-fg-soft">
          Filled from last time: {filled.text}.
          <button
            class="text-brand underline-offset-2 hover:underline"
            onclick={filled.undo}
            type="button"
          >
            Undo
          </button>
        </p>
      {/if}
      {#if create}
        <Field
          error={err("piggy_bank_id")}
          for={id("piggy")}
          label="Piggy bank"
        >
          <RefField
            id={id("piggy")}
            invalid={Boolean(err("piggy_bank_id"))}
            placeholder="(no piggy bank)"
            search={catalog.piggyOptions}
            bind:value={split.piggy}
          />
        </Field>
      {/if}
      <Field
        error={err("tags")}
        for={id("tags")}
        keys={keyHint("#")}
        label="Tags"
      >
        <TagsInput
          id={id("tags")}
          placeholder="Comma or Enter between tags"
          search={(query, taken) => catalog.tagOptions(query, taken)}
          bind:tags={split.tags}
        />
      </Field>
      {#if withdrawal}
        <Field
          error={err("bill_id")}
          for={id("bill")}
          keys={keyHint("s")}
          label="Subscription"
        >
          <RefField
            id={id("bill")}
            invalid={Boolean(err("bill_id"))}
            placeholder="(no subscription)"
            search={catalog.billOptions}
            bind:value={split.bill}
          />
        </Field>
      {/if}
      <Field
        error={err("notes")}
        for={id("notes")}
        keys={keyHint("r")}
        label="Notes"
      >
        <textarea
          class="{INPUT} h-auto max-h-80 min-h-16 py-1.5 leading-snug [field-sizing:content]"
          id={id("notes")}
          bind:value={split.notes}
        ></textarea>
      </Field>
      {#each META_DATES as key (key)}
        {#if showExtra(key, split.dates[key])}
          <Field error={err(key)} for={id(key)} label={META_DATE_LABEL[key]}>
            <DateInput id={id(key)} bind:value={split.dates[key]} />
          </Field>
        {/if}
      {/each}
      {#if showExtra("internal_reference", split.internalReference)}
        <Field
          error={err("internal_reference")}
          for={id("internal-reference")}
          label="Internal reference"
        >
          <input
            class={INPUT}
            id={id("internal-reference")}
            bind:value={split.internalReference}
          >
        </Field>
      {/if}
      {#if showExtra("external_url", split.externalUrl)}
        <Field
          error={err("external_url")}
          for={id("external-url")}
          label="External URL"
        >
          <input
            class={INPUT}
            id={id("external-url")}
            type="url"
            bind:value={split.externalUrl}
          >
        </Field>
      {/if}
      {#if !more}
        <button
          class="self-start text-[12px] text-brand underline-offset-2 hover:underline"
          onclick={() => (more = true)}
          type="button"
        >
          More fields: dates, internal reference, external URL
        </button>
      {/if}
    </div>
  </div>
</Box>
