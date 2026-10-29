<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Plus from "@lucide/svelte/icons/plus";
  import { onMount, tick, untrack } from "svelte";
  import { ApiError, api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, One, TransactionGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import Field from "#lib/components/inputs/Field.svelte";
  import { INPUT } from "#lib/components/inputs/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import { formatMoney } from "#lib/format.js";
  import { prettyKeys, useKeys } from "#lib/keys.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { goto } from "$app/navigation";
  import Attachments, { upload } from "./Attachments.svelte";
  import { Catalog } from "./catalog.svelte.js";
  import Links from "./Links.svelte";
  import {
    type Errors,
    emptyForm,
    emptySplit,
    type Form,
    fromGroup,
    groupTitle,
    KINDS,
    mismatch,
    OWN_SIDE,
    SHARED,
    sideOf,
    switchType,
    TX_TYPES,
    type TxType,
    TYPE_LABEL,
    toAccountRef,
    toPayload,
    total,
    validate,
  } from "./model.js";
  import SplitBox from "./SplitBox.svelte";

  type After = "show" | "another" | "stay";

  const OWN_KEY = "ffui.editor.own";
  const AFTER_KEY = "ffui.editor.after";
  const LEAVE_MS = 3000;
  const LIST: Record<TxType, string> = {
    deposit: "deposit",
    transfer: "transfers",
    withdrawal: "withdrawal",
  };
  const FIELDS: [string, string, string][] = [
    ["d", "description", "description"],
    ["f", "source", "source account"],
    ["t", "destination", "destination account"],
    ["w", "date", "date"],
    ["m", "amount", "amount"],
    ["c", "category", "category"],
    ["b", "budget", "budget"],
    ["s", "bill", "subscription"],
    ["#", "tags", "tags"],
    ["r", "notes", "notes"],
  ];
  const INLINE = new Set([
    "description",
    "source_id",
    "source_name",
    "destination_id",
    "destination_name",
    "date",
    "amount",
    "foreign_amount",
    "foreign_currency_code",
    "category_name",
    "budget_id",
    "bill_id",
    "piggy_bank_id",
    "tags",
    "notes",
    "internal_reference",
    "external_url",
    "interest_date",
    "book_date",
    "process_date",
    "due_date",
    "payment_date",
    "invoice_date",
  ]);

  let {
    initial,
    group = null,
    prefill = {},
  }: {
    initial: Form;
    group?: Item<TransactionGroup> | null;
    prefill?: { source?: string | null; destination?: string | null };
  } = $props();

  const catalog = new Catalog();
  const start = untrack(() => $state.snapshot(initial) as Form);
  const editing = untrack(() => group !== null);
  const originalType = start.type;

  let form = $state<Form>(start);
  let lastSplit = start.splits[0].key;
  let saved = $state(untrack(() => group));
  let snapshot = JSON.stringify(start);
  let errors = $state<Errors>({});
  let status = $state<{
    tone: "ok" | "error" | "info";
    text: string;
    href?: string;
    extra?: string[];
  } | null>(null);
  let saving = $state(false);
  let leaving = $state(false);
  let queued = $state<File[]>([]);
  let applyRules = $state(true);
  let fireWebhooks = $state(true);
  let after = $state<After>(
    (localStorage.getItem(
      `${AFTER_KEY}.${editing ? "edit" : "create"}`
    ) as After) ?? "show"
  );
  let root = $state<HTMLElement | null>(null);

  const problem = $derived(mismatch(form));
  const totals = $derived(total(form));
  const journals = $derived(
    (saved?.attributes.transactions ?? []).map((split, index, list) => ({
      id: split.transaction_journal_id ?? "",
      label:
        list.length > 1
          ? `Split ${index + 1}: ${split.description}`
          : split.description,
    }))
  );
  const title = $derived(
    editing
      ? `Edit transaction "${saved?.attributes.group_title || saved?.attributes.transactions[0]?.description}"`
      : `Create new ${form.type}`
  );

  $effect(() => {
    localStorage.setItem(`${AFTER_KEY}.${editing ? "edit" : "create"}`, after);
  });

  $effect(() => {
    for (const split of form.splits) {
      if (split.reconciled) {
        continue;
      }
      const own = sideOf(form, split, OWN_SIDE[form.type]);
      if (own.currency && own.currency.code !== split.currency?.code) {
        split.currency = own.currency;
      }
      if (form.type === "transfer") {
        const target = sideOf(form, split, "destination").currency;
        const want =
          target && target.code !== split.currency?.code ? target : null;
        if ((want?.code ?? null) !== (split.foreignCurrency?.code ?? null)) {
          split.foreignCurrency = want;
        }
      }
    }
  });

  let prefilled = false;
  $effect(() => {
    if (!catalog.accounts.data || prefilled) {
      return;
    }
    prefilled = true;
    untrack(applyPrefill);
  });

  function applyPrefill() {
    const [first] = form.splits;
    for (const side of ["source", "destination"] as const) {
      const id = prefill[side];
      const found = id ? catalog.accountById(id) : undefined;
      if (found) {
        first[side] = toAccountRef(found);
      }
    }
    const side = OWN_SIDE[form.type];
    if (editing || first[side].id) {
      return;
    }
    const remembered = catalog.accountById(localStorage.getItem(OWN_KEY) ?? "");
    const fallback =
      remembered &&
      KINDS[form.type][side].includes(toAccountRef(remembered).kind)
        ? remembered
        : catalog.defaultAccount();
    if (fallback) {
      first[side] = toAccountRef(fallback);
    }
    snapshot = JSON.stringify($state.snapshot(form));
  }

  onMount(() => {
    tick().then(() => focusField("description", false));
  });

  function splitOf(target: EventTarget | null): number | null {
    const holder =
      target instanceof Element ? target.closest("[data-split]") : null;
    return holder ? Number(holder.getAttribute("data-split")) : null;
  }

  function currentKey(): number {
    const key = splitOf(document.activeElement) ?? lastSplit;
    return form.splits.some((split) => split.key === key)
      ? key
      : form.splits[0].key;
  }

  function focusField(field: string, select = true) {
    const keys = [currentKey(), form.splits[0].key];
    for (const key of keys) {
      const element = document.getElementById(`f-${key}-${field}`);
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
      ) {
        element.focus();
        if (select) {
          element.select();
        }
        return;
      }
    }
  }

  function setType(type: TxType) {
    switchType(form, type);
    if (!editing) {
      goto(`/transactions/create/${type}${location.search}`, {
        replace: true,
        shallow: true,
      });
    }
  }

  async function addSplit() {
    const last = form.splits.at(-1);
    const next = emptySplit();
    if (last) {
      next.currency = last.currency;
      next.foreignCurrency =
        form.type === "transfer" ? last.foreignCurrency : null;
      const counterparty =
        OWN_SIDE[form.type] === "source" ? "destination" : "source";
      if (!SHARED[form.type][counterparty]) {
        next[counterparty] = { ...last[counterparty] };
      }
    }
    form.splits.push(next);
    await tick();
    document.getElementById(`f-${next.key}-description`)?.focus();
  }

  async function removeSplit(key = currentKey()) {
    if (form.splits.length < 2) {
      return;
    }
    const index = form.splits.findIndex((split) => split.key === key);
    if (index === 0) {
      for (const side of ["source", "destination"] as const) {
        if (SHARED[form.type][side]) {
          form.splits[1][side] = form.splits[0][side];
        }
      }
    }
    form.splits.splice(index, 1);
    await tick();
    const focus = form.splits[Math.max(0, index - 1)];
    document.getElementById(`f-${focus.key}-description`)?.focus();
  }

  function money(amount: number, currency: Form["splits"][number]["currency"]) {
    return formatMoney({
      amount,
      code: currency?.code,
      decimals: currency?.decimals,
      symbol: currency?.symbol,
    });
  }

  async function report() {
    const keys = Object.keys(errors);
    const extra = keys
      .filter((key) => {
        const field = key.split(".").at(-1) ?? "";
        return (
          !(key.startsWith("transactions.") && INLINE.has(field)) &&
          key !== "group_title"
        );
      })
      .map((key) => errors[key][0]);
    status = {
      extra,
      text:
        keys.length === 1
          ? "One field needs attention"
          : `${keys.length} fields need attention`,
      tone: "error",
    };
    await tick();
    root?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }

  async function save() {
    if (saving) {
      return;
    }
    errors = validate(form);
    if (Object.keys(errors).length) {
      await report();
      return;
    }
    saving = true;
    status = { text: editing ? "Updating" : "Saving", tone: "info" };
    try {
      const body = toPayload(form, editing, { applyRules, fireWebhooks });
      const result = await api<One<TransactionGroup>>(
        editing ? `/v1/transactions/${saved?.id}` : "/v1/transactions",
        { body, method: editing ? "PUT" : "POST" }
      );
      await finish(result.data);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 422 &&
        Object.keys(error.errors).length
      ) {
        ({ errors } = error);
        await report();
      } else {
        status = {
          text: `Firefly did not save it: ${error instanceof Error ? error.message : error}`,
          tone: "error",
        };
      }
    } finally {
      saving = false;
    }
  }

  async function finish(result: Item<TransactionGroup>) {
    const splits = result.attributes.transactions;
    const failed: string[] = [];
    const results = await Promise.allSettled(
      queued.map((file) => upload(splits[0].transaction_journal_id ?? "", file))
    );
    for (const [index, outcome] of results.entries()) {
      if (outcome.status === "rejected") {
        failed.push(queued[index].name);
      }
    }
    queued = [];
    const own = form.splits[0][OWN_SIDE[form.type]];
    if (own.id) {
      localStorage.setItem(OWN_KEY, own.id);
    }
    await invalidate();
    const label = `"${groupTitle(form) ?? form.splits[0].description}" ${totals.map((entry) => money(entry.amount, entry.currency)).join(" + ")}`;
    const href = `/transactions/show/${result.id}`;
    const uploadNote = failed.length
      ? ` Upload failed for ${failed.join(", ")}.`
      : "";
    if (splits[0].type !== form.type) {
      saved = result;
      form = fromGroup(result);
      snapshot = JSON.stringify($state.snapshot(form));
      status = {
        href,
        text: `Saved, but Firefly kept it as a ${splits[0].type}: these accounts don't fit a ${form.type}.`,
        tone: "error",
      };
      return;
    }
    if (after === "show" && !failed.length) {
      await goto(href);
      return;
    }
    if (after === "another" && !editing) {
      reset();
      status = { href, text: `Saved ${label}.${uploadNote}`, tone: "ok" };
      return;
    }
    if (!editing) {
      await goto(`/transactions/edit/${result.id}`);
      return;
    }
    saved = result;
    form = fromGroup(result);
    snapshot = JSON.stringify($state.snapshot(form));
    errors = {};
    status = { href, text: `Saved ${label}.${uploadNote}`, tone: "ok" };
  }

  function reset() {
    const next = emptyForm(form.type);
    const side = OWN_SIDE[form.type];
    next.date = form.date;
    next.splits[0][side] = form.splits[0][side];
    next.splits[0].currency = form.splits[0].currency;
    form = next;
    errors = {};
    snapshot = JSON.stringify($state.snapshot(form));
    tick().then(() => focusField("description"));
  }

  async function remove() {
    await api(`/v1/transactions/${saved?.id}`, { method: "DELETE" });
    await goto(`/transactions/${LIST[originalType]}`);
    await invalidate();
  }

  function cancel() {
    if (ui.quickEntry || ui.mobileNav) {
      ui.quickEntry = false;
      ui.mobileNav = false;
      return;
    }
    const dirty = JSON.stringify($state.snapshot(form)) !== snapshot;
    if (dirty && !leaving) {
      leaving = true;
      status = {
        text: "Press Esc again to discard your changes",
        tone: "info",
      };
      setTimeout(() => (leaving = false), LEAVE_MS);
      return;
    }
    if (history.length > 1) {
      history.back();
    } else {
      goto(`/transactions/${LIST[form.type]}`);
    }
  }

  useKeys(() => [
    {
      group: "Editor",
      input: true,
      keys: "mod+Enter",
      label: "Save the transaction",
      run: save,
    },
    {
      group: "Editor",
      input: true,
      keys: "mod+shift+Enter",
      label: "Add another split",
      run: addSplit,
    },
    {
      group: "Editor",
      keys: "X",
      label: "Remove the current split",
      run: () => removeSplit(),
    },
    ...TX_TYPES.map((type, index) => ({
      group: "Editor",
      keys: `${index + 1}`,
      label: `Make it a ${type}`,
      run: () => setType(type),
    })),
    ...FIELDS.map(([keys, field, label]) => ({
      group: "Editor",
      keys,
      label: `Go to ${label}`,
      run: () => focusField(field),
    })),
    {
      group: "Editor",
      keys: "T",
      label: "Go to the split transaction title",
      run: () => document.getElementById("group-title")?.focus(),
    },
    {
      group: "Editor",
      keys: "Escape",
      label: "Cancel and go back",
      run: cancel,
    },
  ]);

  const TONE = {
    error: "text-expense",
    info: "text-cladd-fg-soft",
    ok: "text-income",
  };
  const TYPE_TONE: Record<TxType, string> = {
    deposit: "text-income",
    transfer: "text-transfer",
    withdrawal: "text-expense",
  };
</script>

<PageHeader
  crumbs={[
    { href: `/transactions/${LIST[originalType]}`, label: "Transactions" },
    { label: editing ? `Edit #${saved?.id}` : `Create new ${form.type}` },
  ]}
  subtitle={title}
  title="Transactions"
>
  {#snippet actions()}
    {#if editing && saved}
      <a
        class="cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-[12px] text-cladd-fg"
        href="/transactions/create/{form.type}?clone={saved.id}"
      >
        <Copy class="size-3.5" />
        Clone
      </a>
      <ConfirmButton onconfirm={remove}>Delete</ConfirmButton>
    {/if}
  {/snippet}
</PageHeader>

<div
  class="flex flex-col gap-4"
  onfocusin={(event) => (lastSplit = splitOf(event.target) ?? lastSplit)}
  bind:this={root}
>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <div
      aria-label="Transaction type"
      class="cladd-cut inline-flex h-9 items-center gap-0.5 rounded-full p-0.5 sm:h-8"
      role="tablist"
    >
      {#each TX_TYPES as type, index (type)}
        <button
          aria-selected={form.type === type}
          class="cladd-segment cladd-focusable inline-flex h-full items-center gap-2 rounded-full px-3 font-semibold text-[13px] {form.type ===
          type
            ? TYPE_TONE[type]
            : "text-cladd-fg-soft"}"
          onclick={() => setType(type)}
          role="tab"
          tabindex={form.type === type ? 0 : -1}
          type="button"
        >
          {TYPE_LABEL[type]}
          <span class="kbd hidden lg:inline-flex">{index + 1}</span>
        </button>
      {/each}
    </div>
    {#if editing && form.type !== originalType}
      <p class="text-[13px] text-warn">
        Saving converts this {originalType} into a {form.type}.
      </p>
    {/if}
    {#if problem}
      <p class="text-[13px] text-warn" role="alert">
        {problem.from}
        to {problem.to.toLowerCase()}
        {problem.suggest
          ? `is a ${problem.suggest}, not a ${form.type}.`
          : `does not work as a ${form.type}.`}
        {#if problem.suggest}
          {@const suggest = problem.suggest}
          <button
            class="ml-1 font-semibold text-brand underline-offset-2 hover:underline"
            onclick={() => setType(suggest)}
            type="button"
          >
            Make it a {suggest}
          </button>
        {/if}
      </p>
    {/if}
  </div>

  {#each form.splits as split, index (split.key)}
    <div data-split={split.key}>
      <SplitBox
        {catalog}
        create={!editing}
        {errors}
        {index}
        onremove={() => removeSplit(split.key)}
        bind:form
      />
    </div>
  {/each}

  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <button
      class="cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-md items-center gap-1.5 rounded-cladd-md px-2.5 font-semibold text-[12px] text-cladd-fg"
      onclick={addSplit}
      type="button"
    >
      <Plus class="size-3.5" />
      Add another split
      <span class="kbd hidden lg:inline-flex"
        >{prettyKeys("mod+shift+Enter")[0]}</span
      >
    </button>
    {#if form.splits.length > 1}
      <span class="text-[13px] text-cladd-fg-soft">
        Total of {form.splits.length} splits:
        {#each totals as entry, index (entry.currency?.code ?? index)}
          <span class="num ml-1 font-semibold text-cladd-fg"
            >{money(entry.amount, entry.currency)}</span
          >
        {/each}
      </span>
    {/if}
  </div>

  {#if form.splits.length > 1}
    <Box title="Split transaction">
      <Field
        error={errors.group_title?.[0]}
        for="group-title"
        keys="T"
        label="Description of the split transaction"
      >
        <input
          class={INPUT}
          id="group-title"
          placeholder={form.splits[0].description}
          bind:value={form.title}
        >
      </Field>
    </Box>
  {/if}

  <div class="grid gap-4 lg:grid-cols-2">
    <Attachments groupId={saved?.id ?? null} {journals} bind:queued />
    {#if editing && journals.length}
      <Links {journals} />
    {/if}
  </div>

  <div
    class="cladd-surface cladd-outline sticky bottom-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-cladd-lg px-3 py-2 sm:gap-x-4 sm:py-2.5 shadow-[0_-6px_16px_-12px_rgb(0_0_0/0.35)]"
  >
    <Button
      class="h-9 px-3.5 text-[13px] sm:h-cladd-md"
      color="brand"
      disabled={saving}
      onclick={save}
      variant="fill"
    >
      {editing ? "Update transaction" : "Save transaction"}
      <span
        class="kbd hidden bg-white/20! text-current! shadow-none! sm:inline-flex"
        >{prettyKeys("mod+Enter")[0]}</span
      >
    </Button>
    <label class="flex items-center gap-2 text-[13px] text-cladd-fg-soft">
      <span class="hidden sm:inline">After saving</span>
      <select
        aria-label="After saving"
        class="cladd-cut h-8 rounded-cladd-md px-2 text-[13px] text-cladd-fg sm:h-cladd-md"
        bind:value={after}
      >
        <option value="show">show the transaction</option>
        {#if !editing}
          <option value="another">create another one</option>
        {/if}
        <option value="stay">stay here to edit</option>
      </select>
    </label>
    <label
      class="hidden items-center gap-1.5 text-[13px] text-cladd-fg-soft sm:flex"
    >
      <input class="accent-brand" type="checkbox" bind:checked={applyRules}>
      Apply rules
    </label>
    <label
      class="hidden items-center gap-1.5 text-[13px] text-cladd-fg-soft sm:flex"
    >
      <input class="accent-brand" type="checkbox" bind:checked={fireWebhooks}>
      Fire webhooks
    </label>
    {#if status}
      <p
        class="min-w-0 basis-full text-[13px] sm:basis-auto {TONE[status.tone]}"
        role="status"
      >
        {status.text}
        {#each status.extra ?? [] as line (line)}
          <span class="block">{line}</span>
        {/each}
        {#if status.href}
          <a
            class="ml-1 text-brand underline-offset-2 hover:underline"
            href={status.href}
            >Open</a
          >
        {/if}
      </p>
    {/if}
  </div>
</div>
