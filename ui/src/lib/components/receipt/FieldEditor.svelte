<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import type { Split } from "#lib/api/types.js";
  import AccountField from "#lib/components/editor/AccountField.svelte";
  import type { Catalog } from "#lib/components/editor/catalog.svelte.js";
  import {
    type AccountRef,
    CASH,
    emptyRef,
    FREE_KIND,
    KINDS,
    OWN_SIDE,
    type Ref,
    SHARED,
    type Side,
    type TxType,
  } from "#lib/components/editor/model.js";
  import RefField from "#lib/components/editor/RefField.svelte";
  import AmountInput from "#lib/components/inputs/AmountInput.svelte";
  import AutocompleteInput from "#lib/components/inputs/AutocompleteInput.svelte";
  import DateInput from "#lib/components/inputs/DateInput.svelte";
  import { amountString, evalAmount } from "#lib/components/inputs/parse.js";
  import { INPUT } from "#lib/components/inputs/styles.js";
  import TagsInput from "#lib/components/inputs/TagsInput.svelte";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import type { Patch } from "#lib/transactions/mass.js";
  import { FIELD_LABEL, type FieldName, type Row } from "./fields.js";

  type Outcome = { patch: Patch; all: boolean } | { problem: string } | null;

  let {
    row,
    split,
    type,
    catalog,
    onsave,
    oncancel,
  }: {
    row: Row;
    split: Split;
    type: TxType;
    catalog: Catalog;
    onsave: (patch: Patch, all: boolean) => Promise<string | null>;
    oncancel: () => void;
  } = $props();

  const field = $derived(row.field);
  const side = $derived<Side>(
    row.field === "destination" ? "destination" : "source"
  );
  const decimals = (value: number | null | undefined) => value ?? 2;
  const fixed = (value: string | null | undefined, places: number) =>
    value ? Number(value).toFixed(places) : "";

  function initialText() {
    if (row.field === "category") {
      return split.category_name ?? "";
    }
    return (row.field === "notes" ? split.notes : split.description) ?? "";
  }

  function initialAccount(): AccountRef {
    const id = split[`${side}_id`] ?? null;
    const kind = split[`${side}_type`] ?? "";
    return kind === CASH
      ? { currency: null, id: null, kind: CASH, name: "" }
      : { currency: null, id, kind, name: split[`${side}_name`] ?? "" };
  }

  function initialRef(): Ref {
    const id = row.field === "bill" ? split.bill_id : split.budget_id;
    const name = row.field === "bill" ? split.bill_name : split.budget_name;
    return id ? { id, name: name ?? "" } : emptyRef();
  }

  let root = $state<HTMLElement | null>(null);
  const start = untrack(() => ({
    account: initialAccount(),
    amount: fixed(split.amount, decimals(split.currency_decimal_places)),
    date: split.date.slice(0, 10),
    foreign: fixed(
      split.foreign_amount,
      decimals(split.foreign_currency_decimal_places)
    ),
    ref: initialRef(),
    tags: [...(split.tags ?? [])],
    text: initialText(),
  }));
  let text = $state(start.text);
  let date = $state(start.date);
  let amount = $state(start.amount);
  let foreign = $state(start.foreign);
  let account = $state<AccountRef>(start.account);
  let ref = $state<Ref>(start.ref);
  let tags = $state<string[]>(start.tags);
  let saving = $state(false);
  let problem = $state("");

  const positive = (value: string) => (evalAmount(value) ?? 0) > 0;

  function amountOutcome(): Outcome {
    if (!positive(amount)) {
      return { problem: "The amount must be a positive number" };
    }
    const patch: Patch = {
      amount: amountString(amount, decimals(split.currency_decimal_places)),
    };
    const code = split.foreign_currency_code;
    if (code && !foreign.trim() && type === "transfer") {
      return { problem: `Enter the amount in ${code}` };
    }
    if (code && foreign.trim() && !positive(foreign)) {
      return { problem: "The foreign amount must be a positive number" };
    }
    if (code) {
      patch.foreign_amount = foreign.trim()
        ? amountString(foreign, decimals(split.foreign_currency_decimal_places))
        : "0";
    }
    const same =
      Number(patch.amount) === Number(split.amount) &&
      (!code || Number(patch.foreign_amount) === Number(split.foreign_amount));
    return same ? null : { all: false, patch };
  }

  function accountOutcome(): Outcome {
    const name = account.name.trim();
    const all = SHARED[type][side];
    const other = split[`${side === "source" ? "destination" : "source"}_id`];
    if (!(account.id || (name && FREE_KIND[type][side]))) {
      return { problem: `Choose the ${FIELD_LABEL[row.field]}` };
    }
    if (account.id && !KINDS[type][side].includes(account.kind)) {
      return {
        problem: `A ${account.kind.toLowerCase()} can't be the ${side} of a ${type}`,
      };
    }
    if (account.id && account.id === other) {
      return { problem: "Source and destination are the same account" };
    }
    const want =
      side === OWN_SIDE[type]
        ? split.currency_code
        : type === "transfer" &&
          (split.foreign_currency_code ?? split.currency_code);
    if (want && account.currency && account.currency.code !== want) {
      return {
        problem: `${account.name} is in ${account.currency.code}, this amount is in ${want}. Press e to change both`,
      };
    }
    if (account.id === split[`${side}_id`]) {
      return null;
    }
    return {
      all,
      patch: account.id
        ? { [`${side}_id`]: account.id }
        : { [`${side}_name`]: name },
    };
  }

  function textOutcome(
    key: "description" | "notes" | "category_name",
    current: string | null | undefined
  ): Outcome {
    const value = text.trim() || null;
    return value === (current || null)
      ? null
      : { all: false, patch: { [key]: value } };
  }

  function dateOutcome(): Outcome {
    if (!date) {
      return { problem: "Enter a date like today, -1, 14.10 or 2026-10-14" };
    }
    return date === split.date.slice(0, 10)
      ? null
      : { all: true, patch: { date: `${date}T${split.date.slice(11, 19)}` } };
  }

  function refOutcome(key: "bill_id" | "budget_id"): Outcome {
    if (!ref.id && ref.name.trim()) {
      return { problem: `Pick an existing ${FIELD_LABEL[row.field]}` };
    }
    return (ref.id ?? null) === (split[key] ?? null)
      ? null
      : { all: false, patch: { [key]: ref.id } };
  }

  const OUTCOMES: Record<FieldName, () => Outcome> = {
    amount: amountOutcome,
    bill: () => refOutcome("bill_id"),
    budget: () => refOutcome("budget_id"),
    category: () => textOutcome("category_name", split.category_name),
    date: dateOutcome,
    description: () =>
      text.trim()
        ? textOutcome("description", split.description)
        : { problem: "Describe the transaction" },
    destination: accountOutcome,
    notes: () => textOutcome("notes", split.notes),
    source: accountOutcome,
    tags: () =>
      JSON.stringify(tags) === JSON.stringify(split.tags ?? [])
        ? null
        : { all: false, patch: { tags } },
  };

  async function submit() {
    if (saving) {
      return;
    }
    const result = OUTCOMES[row.field]();
    if (result === null) {
      oncancel();
      return;
    }
    if ("problem" in result) {
      ({ problem } = result);
      return;
    }
    saving = true;
    problem = (await onsave(result.patch, result.all)) ?? "";
    saving = false;
  }

  function pickSaves() {
    queueMicrotask(() => {
      if (root?.contains(document.activeElement)) {
        submit();
      }
    });
  }

  onMount(async () => {
    await tick();
    const input = root?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      "input:not([type=date]):not([tabindex='-1']), textarea"
    );
    input?.focus();
    if (row.field !== "notes") {
      input?.select();
    }
  });

  useKeys(() => [
    {
      group: "Field",
      input: true,
      keys: "Escape",
      label: "Cancel the field",
      run: oncancel,
    },
    {
      group: "Field",
      input: true,
      keys: "mod+Enter",
      label: "Save the field",
      run: submit,
    },
  ]);

  const id = $derived(`receipt-${row.key.replace(":", "-")}`);
  const BUTTON =
    "cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1 rounded-cladd-sm px-2 font-semibold text-[12px] text-cladd-fg disabled:opacity-60";
</script>

<form
  aria-label="Edit {FIELD_LABEL[field]}"
  class="min-w-0 flex-wrap items-center gap-x-2 gap-y-1 {field === "notes" ||
  field === "description"
    ? "flex w-full"
    : "inline-flex align-middle"}"
  onsubmit={(event) => {
    event.preventDefault();
    submit();
  }}
  bind:this={root}
>
  {#if field === "description"}
    <input
      aria-label="Description"
      class="{INPUT} max-w-2xl flex-1 sm:text-[15px]"
      {id}
      bind:value={text}
    >
  {:else if field === "notes"}
    <textarea
      aria-label="Notes"
      class="{INPUT} h-auto max-h-[60vh] min-h-24 w-full py-1.5 leading-relaxed [field-sizing:content]"
      {id}
      bind:value={text}
    ></textarea>
  {:else if field === "category"}
    <AutocompleteInput
      aria-label="Category"
      class="w-56"
      free
      {id}
      onpick={pickSaves}
      openOnFocus
      placeholder="(no category)"
      search={catalog.categoryOptions}
      bind:value={text}
    />
  {:else if field === "budget" || field === "bill"}
    <div class="w-56">
      <RefField
        {id}
        onpick={pickSaves}
        placeholder={field === "bill" ? "(no subscription)" : "(no budget)"}
        search={field === "bill" ? catalog.billOptions : catalog.budgetOptions}
        bind:value={ref}
      />
    </div>
  {:else if field === "tags"}
    <div class="w-72">
      <TagsInput
        {id}
        placeholder="Comma or Enter between tags"
        search={(query, taken) => catalog.tagOptions(query, taken)}
        bind:tags
      />
    </div>
  {:else if field === "date"}
    <DateInput
      aria-label="Date"
      class="w-56"
      {id}
      placeholder="today, -1, 14.10"
      bind:value={date}
    />
  {:else if field === "amount"}
    <AmountInput
      aria-label="Amount"
      class="w-40"
      currency={split.currency_code ?? ""}
      decimals={decimals(split.currency_decimal_places)}
      {id}
      bind:value={amount}
    />
    {#if split.foreign_currency_code}
      <AmountInput
        aria-label="Amount in {split.foreign_currency_code}"
        class="w-36"
        currency={split.foreign_currency_code}
        decimals={decimals(split.foreign_currency_decimal_places)}
        bind:value={foreign}
      />
    {/if}
  {:else}
    <div class="w-72">
      <AccountField
        {catalog}
        free={Boolean(FREE_KIND[type][side])}
        {id}
        kinds={KINDS[type][side]}
        onpick={pickSaves}
        placeholder={FREE_KIND[type][side] ? "a new name" : ""}
        bind:value={account}
      />
    </div>
  {/if}
  <span class="flex items-center gap-1.5">
    <button class={BUTTON} disabled={saving} type="submit">
      Save
      <span class="kbd hidden lg:inline-flex"
        >{field === "notes" ? prettyKeys("mod+Enter")[0] : "↵"}</span
      >
    </button>
    <button class={BUTTON} onclick={oncancel} type="button">
      Cancel <span class="kbd hidden lg:inline-flex">Esc</span>
    </button>
  </span>
  {#if saving || problem}
    <span
      class="text-[12px] {problem ? "text-expense" : "text-cladd-fg-soft"}"
      role="status"
      >{saving ? "Saving" : problem}</span
    >
  {/if}
</form>
