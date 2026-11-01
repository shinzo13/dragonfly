<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { createQuery } from "@tanstack/svelte-query";
  import { DropdownMenu } from "bits-ui";
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type {
    Bill,
    Item,
    One,
    Split,
    TransactionGroup,
  } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { Catalog } from "#lib/components/editor/catalog.svelte.js";
  import {
    META_DATE_LABEL,
    META_DATES,
    type TxType,
  } from "#lib/components/editor/model.js";
  import Context from "#lib/components/receipt/Context.svelte";
  import Extras from "#lib/components/receipt/Extras.svelte";
  import FieldEditor from "#lib/components/receipt/FieldEditor.svelte";
  import {
    FIELD_LABEL,
    type FieldName,
    type Row,
    rowKey,
    rowsOf,
  } from "#lib/components/receipt/fields.js";
  import { openSplits, suggest } from "#lib/components/receipt/match.js";
  import Notes from "#lib/components/receipt/Notes.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import {
    average,
    money as billMoney,
    isRange,
    repeats,
  } from "#lib/components/subscriptions/bills.js";
  import TypeIcon from "#lib/components/transactions/TypeIcon.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import DropdownMenuContent from "#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte";
  import DropdownMenuItem from "#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte";
  import DropdownMenuSeparator from "#lib/components/ui/dropdown-menu/dropdown-menu-separator.svelte";
  import { formatDate, formatDateTime, formatMoney } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { type Patch, updateGroups } from "#lib/transactions/mass.js";
  import {
    accountUrl,
    cloneUrl,
    editUrl,
    groupTitle,
    groupType,
    isCash,
    journalId,
    LIST_TITLE,
    listPath,
    type Signed,
    signedAmount,
    signedForeign,
    sumByCurrency,
    TYPE_LABEL,
  } from "#lib/transactions/split.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const OWN: Record<string, "source" | "destination"> = {
    deposit: "destination",
    transfer: "source",
    withdrawal: "source",
  };
  const TONE: Record<string, string> = {
    expense: "text-expense",
    income: "text-income",
    neutral: "text-cladd-fg",
    transfer: "text-transfer",
  };
  const PICKS: [string, FieldName][] = [
    ["s c", "category"],
    ["s b", "budget"],
    ["s t", "tags"],
    ["s s", "bill"],
  ];
  const REFERENCES = [
    ["external_id", "external ID"],
    ["internal_reference", "reference"],
    ["sepa_ct_id", "SEPA end to end ID"],
    ["sepa_db", "SEPA mandate"],
    ["sepa_ci", "SEPA creditor"],
  ] as const;
  const ERROR_PREFIX = /^#\d+: /;
  const PLAIN =
    "rounded-[4px] text-cladd-fg-softer hover:text-cladd-fg hover:underline";

  let confirm = $state<ConfirmButton>();
  let deleteError = $state("");
  let editing = $state<string | null>(null);
  let linking = $state("");
  let linked = $state<Set<string>>(new Set());

  const id = $derived(page.params.id ?? "");
  const groupQuery = createQuery(() => ({
    queryFn: () => api<One<TransactionGroup>>(`/v1/transactions/${id}`),
    queryKey: ["transaction", id],
  }));
  const group = $derived(groupQuery.data?.data);
  const splits = $derived(group?.attributes.transactions ?? []);
  const first = $derived(splits[0]);
  const type = $derived(group ? groupType(group) : "withdrawal");
  const title = $derived(group ? groupTitle(group) : "");
  const many = $derived(splits.length > 1);
  const actionable = $derived(
    ["withdrawal", "deposit", "transfer", "reconciliation"].includes(type)
  );
  const rows = $derived(rowsOf(splits));
  const rowIndex = $derived(new Map(rows.map((row, i) => [row.key, i])));
  const catalog = new Catalog();

  const unlinked = $derived(openSplits(splits));
  const matchQuery = createQuery(() => ({
    enabled: unlinked.length > 0,
    queryFn: () => suggest(splits),
    queryKey: [
      "receipt",
      "bill-match",
      id,
      unlinked.map((split) => `${journalId(split)}:${split.amount}`).join(","),
    ],
  }));
  const suggestions = $derived(unlinked.length ? (matchQuery.data ?? []) : []);

  const nav = new ListNav<Row>({
    id: "receipt",
    items: () => rows,
    key: (row) => row.key,
    open: openRow,
  });
  nav.use();

  $effect.pre(() => {
    if (id) {
      untrack(() => {
        editing = null;
        linked = new Set();
        linking = "";
        nav.cursor = -1;
      });
    }
  });

  const own = $derived(OWN[type]);
  function balanceOf(side: "source" | "destination") {
    const values = splits
      .map((split) => split[`${side}_balance_after`])
      .filter((value) => value !== null && value !== undefined)
      .map(Number);
    if (!(values.length && first)) {
      return null;
    }
    const foreign =
      side === "destination" &&
      type === "transfer" &&
      Boolean(first.foreign_currency_code);
    return display.text([
      {
        amount:
          side === "destination" ? Math.max(...values) : Math.min(...values),
        code: foreign ? first.foreign_currency_code : first.currency_code,
        decimals: foreign
          ? first.foreign_currency_decimal_places
          : first.currency_decimal_places,
        symbol: foreign ? first.foreign_currency_symbol : first.currency_symbol,
      },
    ]);
  }

  const balances = $derived(
    (type === "transfer" ? ["source", "destination"] : [own])
      .filter((side): side is "source" | "destination" => Boolean(side))
      .map(balanceOf)
      .filter((value) => value !== null)
  );

  const foreignTotals = $derived.by(() => {
    const sums = new Map<string, Signed>();
    for (const split of splits) {
      const foreign = signedForeign(split);
      if (!foreign) {
        continue;
      }
      const sum = sums.get(foreign.code ?? "");
      if (sum) {
        sum.amount += foreign.amount;
      } else {
        sums.set(foreign.code ?? "", { ...foreign });
      }
    }
    return [...sums.values()];
  });

  const totalApprox = $derived(
    approxOf(
      sumByCurrency(splits),
      foreignTotals.find((sum) => sum.code === display.code)?.code
    )
  );

  const counterSide = $derived<"source" | "destination" | null>(
    { deposit: "source", withdrawal: "destination" }[type as string] as
      | "source"
      | "destination"
      | null
  );

  function openRow(row: Row) {
    nav.cursor = rowIndex.get(row.key) ?? nav.cursor;
    editing = row.key;
  }

  function openField(field: FieldName, index: number) {
    const at = rowIndex.get(rowKey(field, index));
    if (at !== undefined) {
      openRow(rows[at]);
    }
  }

  async function save(
    row: Row,
    patch: Patch,
    all: boolean
  ): Promise<string | null> {
    const split = splits[row.index];
    const outcome = await updateGroups(
      new Map([[id, all ? null : new Set([journalId(split)])]]),
      () => patch,
      () => undefined
    );
    if (outcome.errors.length) {
      return outcome.errors[0].replace(ERROR_PREFIX, "");
    }
    await invalidate();
    editing = null;
    return null;
  }

  async function link() {
    if (!suggestions.length || linking === "Linking") {
      return;
    }
    linking = "Linking";
    const bills = new Map(suggestions.map((s) => [s.journal, s.bill.id]));
    const outcome = await updateGroups(
      new Map([[id, new Set(bills.keys())]]),
      (split) => ({ bill_id: bills.get(journalId(split)) }),
      () => undefined
    );
    if (outcome.errors.length) {
      linking = outcome.errors[0].replace(ERROR_PREFIX, "");
      return;
    }
    await invalidate();
    linked = new Set(bills.keys());
    linking = "";
  }

  function approxOf(parts: Signed[], foreign?: string | null) {
    const total = display.total(parts);
    if (!total?.converted || foreign === display.code) {
      return "";
    }
    return `≈${formatMoney(total, parts[0]?.tone !== "transfer")}`;
  }

  function dateLabel(value: string | undefined) {
    if (!value) {
      return "";
    }
    const day = value.slice(0, 10);
    const time = value.slice(11, 16);
    const label = `${formatDate(day, "day")} ${day.slice(0, 4)}`;
    return time && time !== "00:00" ? `${label}, ${time}` : label;
  }

  function billPrice(bill: Item<Bill>) {
    const a = bill.attributes;
    const value = display.text([
      billMoney(a, isRange(a) ? average(a) : Number(a.amount_min)),
    ]);
    const rough = isRange(a) && !value.startsWith("≈");
    return `${rough ? "~" : ""}${value} ${repeats(a)}`;
  }

  async function remove() {
    deleteError = "";
    try {
      await api(`/v1/transactions/${id}`, { method: "DELETE" });
      await invalidate();
      await goto(listPath(type));
    } catch (error) {
      deleteError = error instanceof Error ? error.message : String(error);
    }
  }

  function oldUi(path = page.url.pathname) {
    location.assign(oldUiUrl(new URL(path, location.origin).href));
  }

  const others = $derived(
    ["withdrawal", "deposit", "transfer"].filter((t) => t !== type)
  );

  useKeys(() => {
    if (!(group && actionable)) {
      return [];
    }
    const at = nav.current?.index ?? 0;
    return [
      {
        group: "Transaction",
        keys: "e",
        label: "Edit every field",
        run: () => goto(editUrl(id)),
      },
      ...(type === "reconciliation"
        ? []
        : [
            {
              group: "Transaction",
              keys: "c",
              label: "Clone transaction",
              run: () => goto(cloneUrl(group)),
            },
          ]),
      {
        group: "Transaction",
        keys: "d",
        label: "Delete transaction (press twice)",
        run: () => confirm?.press(),
      },
      ...(suggestions.length
        ? [
            {
              group: "Transaction",
              keys: "y",
              label: `Link to the subscription ${suggestions[0].bill.attributes.name}`,
              run: link,
            },
          ]
        : []),
      ...PICKS.filter(([, field]) => rowIndex.has(rowKey(field, at))).map(
        ([keys, field]) => ({
          group: "Transaction",
          keys,
          label: `Change the ${FIELD_LABEL[field]}`,
          run: () => openField(field, at),
        })
      ),
    ];
  });
</script>

{#snippet money(
  value: Signed,
  size = ""
)}
  <span class="num {TONE[value.tone]} {size}"
    >{formatMoney(value, value.tone !== "transfer")}</span
  >
{/snippet}

{#snippet approx(
  parts: Signed[],
  foreign?: string | null
)}
  {@const text = approxOf(parts, foreign)}
  {#if text}
    <span
      class="num ml-1.5 text-[max(12px,0.55em)] font-medium text-cladd-fg-soft"
      >{text}</span
    >
  {/if}
{/snippet}

{#snippet account(
  split: Split,
  side: "source" | "destination"
)}
  {#if isCash(split[`${side}_type`])}
    <span class="text-income">(cash)</span>
  {:else}
    <a class="text-brand hover:underline" href={accountUrl(split[`${side}_id`])}
      >{split[`${side}_name`]}</a
    >
  {/if}
{/snippet}

{#snippet empty(
  text: string,
  field: FieldName,
  index: number
)}
  {#if rowIndex.has(rowKey(field, index))}
    <button class={PLAIN} onclick={() => openField(field, index)} type="button">
      {text}
    </button>
  {:else}
    <span class="text-cladd-fg-softer">{text}</span>
  {/if}
{/snippet}

{#snippet view(
  field: FieldName,
  split: Split,
  index: number
)}
  {#if field === "date"}
    <span class="num">{dateLabel(split.date)}</span>
  {:else if field === "description"}
    {split.description}
  {:else if field === "amount"}
    {@const foreign = signedForeign(split)}
    {@render money(signedAmount(split))}
    {#if foreign}
      <span
        class="num ml-1.5 text-[max(12px,0.55em)] font-medium text-cladd-fg-soft"
        >{formatMoney(foreign)}</span
      >
    {/if}
    {@render approx([signedAmount(split)], foreign?.code)}
  {:else if field === "source" || field === "destination"}
    {@render account(split, field)}
  {:else if field === "category"}
    {#if split.category_id}
      <span class="text-cladd-fg-soft">category</span>
      <a
        class="text-brand hover:underline"
        href="/categories/show/{split.category_id}"
        >{split.category_name}</a
      >
    {:else}
      {@render empty("no category", field, index)}
    {/if}
  {:else if field === "budget"}
    {#if split.budget_id}
      <span class="text-cladd-fg-soft">budget</span>
      <a
        class="text-brand hover:underline"
        href="/budgets/show/{split.budget_id}"
        >{split.budget_name}</a
      >
    {:else}
      {@render empty("no budget", field, index)}
    {/if}
  {:else if field === "tags"}
    {#if split.tags?.length}
      <span class="text-cladd-fg-soft"
        >{split.tags.length === 1 ? "tag" : "tags"}</span
      >
      {#each split.tags as tag, i (tag)}
        {#if i > 0}
          ,
        {/if}
        <a
          class="text-brand hover:underline"
          href="/tags/show/{encodeURIComponent(tag)}"
          >{tag}</a
        >
      {/each}
    {:else}
      {@render empty("no tags", field, index)}
    {/if}
  {:else if field === "bill"}
    {#if split.bill_id}
      <span class="text-cladd-fg-soft">subscription</span>
      <a
        class="text-brand hover:underline"
        href="/subscriptions/show/{split.bill_id}"
        >{split.bill_name}</a
      >
      {#if linked.has(journalId(split))}
        <span class="text-income">linked</span>
      {/if}
    {:else}
      {@render empty("no subscription", field, index)}
    {/if}
  {:else if split.notes}
    <Notes text={split.notes} />
  {:else}
    <span class="text-[13px]">{@render empty("Add notes", field, index)}</span>
  {/if}
{/snippet}

{#snippet cell(
  field: FieldName,
  index: number
)}
  {@const split = splits[index]}
  {@const at = rowIndex.get(rowKey(field, index))}
  {#if at !== undefined && editing === rows[at].key}
    <FieldEditor
      {catalog}
      oncancel={() => (editing = null)}
      onsave={(patch, all) => save(rows[at], patch, all)}
      row={rows[at]}
      {split}
      type={type as TxType}
    />
  {:else}
    <svelte:element
      class="rounded-[4px] {at !== undefined && nav.cursor === at
        ? "bg-row-cursor ring-4 ring-row-cursor"
        : ""}"
      id={at === undefined ? undefined : nav.rowId(at)}
      this={field === "notes" ? "div" : "span"}
    >
      {@render view(field, split, index)}
    </svelte:element>
  {/if}
{/snippet}

{#snippet suggestion(
  split: Split
)}
  {@const found = suggestions.find((s) => s.journal === journalId(split))}
  {#if found}
    <div class="flex flex-wrap items-baseline gap-x-1.5">
      <span class="text-cladd-fg-soft">Looks like the subscription</span>
      <a
        class="text-brand hover:underline"
        href="/subscriptions/show/{found.bill.id}"
        >{found.bill.attributes.name}</a
      >
      <span class="text-cladd-fg-soft"
        >({billPrice(found.bill)},
        <span class={found.paid ? "text-warn" : ""}
          >{found.paid
            ? `already paid ${formatDate(found.paid, "short")}`
            : `unpaid for ${formatDate(found.month, "month")}`}</span
        >).</span
      >
      {#if linking && linking !== "Linking"}
        <span class="text-expense" role="status">{linking}</span>
      {:else}
        <button
          class="inline-flex items-center gap-1 font-semibold text-brand hover:underline max-sm:min-h-10"
          disabled={linking === "Linking"}
          onclick={link}
          type="button"
        >
          {linking === "Linking" ? "Linking" : "Link it"}
          <span class="kbd hidden lg:inline-flex">y</span>
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet classes(
  split: Split,
  index: number
)}
  {@const fields = (
    split.type === "withdrawal"
      ? ["category", "budget", "tags", "bill"]
      : ["category", "tags"]
  ) as FieldName[]}
  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
    {#each fields as field, i (field)}
      <span class="inline-flex items-baseline gap-x-2">
        {@render cell(field, index)}
        {#if i < fields.length - 1}
          <span class="text-cladd-fg-softer">·</span>
        {/if}
      </span>
    {/each}
  </div>
  {#if !split.bill_id}
    {@render suggestion(split)}
  {/if}
  {@const dates = META_DATES.filter((key) => split[key])}
  {@const refs = REFERENCES.filter(([key]) => split[key])}
  {#if dates.length || refs.length || split.external_url || split.recurrence_id}
    <div
      class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px] text-cladd-fg-soft"
    >
      {#each dates as key (key)}
        <span
          >{META_DATE_LABEL[key].toLowerCase()}
          <span class="num text-cladd-fg">{formatDate(split[key])}</span></span
        >
      {/each}
      {#each refs as [key, label] (key)}
        <span
          >{label}
          <span class="break-all text-cladd-fg">{split[key]}</span></span
        >
      {/each}
      {#if split.recurrence_id}
        <a
          class="text-brand hover:underline"
          href="/recurring/show/{split.recurrence_id}"
          >recurring, {split.recurrence_count}
          of {split.recurrence_total || "∞"}</a
        >
      {/if}
      {#if split.external_url}
        <a
          class="break-all text-brand hover:underline"
          href={split.external_url}
          rel="noopener noreferrer nofollow"
          target="_blank"
          >{split.external_url}</a
        >
      {/if}
    </div>
  {/if}
{/snippet}

<PageHeader
  crumbs={[
    { href: listPath(type), label: LIST_TITLE[type] ?? "Transactions" },
    { label: title || `#${id}` },
  ]}
  title="Transactions"
>
  {#snippet actions()}
    {#if group}
      <div class="flex min-w-0 flex-wrap items-center gap-1.5">
        {#if actionable}
          <Button href={editUrl(id)} size="sm" variant="outline">
            <Pencil />Edit <span class="kbd">e</span>
          </Button>
          {#if type !== "reconciliation"}
            <Button href={cloneUrl(group)} size="sm" variant="outline">
              <Copy />Clone <span class="kbd">c</span>
            </Button>
          {/if}
          <ConfirmButton onconfirm={remove} bind:this={confirm}>
            Delete <span class="kbd">d d</span>
          </ConfirmButton>
        {/if}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class="cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1 rounded-cladd-sm px-2 font-semibold text-[12px] text-cladd-fg"
          >
            More <ChevronDown class="size-3.5" />
          </DropdownMenu.Trigger>
          <DropdownMenuContent align="end" class="w-72">
            {#if actionable && type !== "reconciliation"}
              {#each others as target (target)}
                <DropdownMenuItem
                  onSelect={() =>
                    location.assign(`/transactions/convert/${target}/${id}`)}
                >
                  Convert to a {target}
                </DropdownMenuItem>
              {/each}
              <DropdownMenuSeparator />
            {/if}
            <DropdownMenuItem
              onSelect={() =>
                location.assign(
                  `/rules/create-from-journal/${journalId(splits[0])}`
                )}
            >
              Create rule based on transaction
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                location.assign(
                  `/recurring/create-from-transaction/${journalId(splits[0])}`
                )}
            >
              Create recurring transaction based on transaction
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => oldUi()}>
              Open in old UI
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu.Root>
      </div>
    {/if}
  {/snippet}
</PageHeader>

{#if groupQuery.isPending}
  <p class="text-cladd-fg-soft">Loading transaction...</p>
{:else if groupQuery.error || !group || !first}
  <Box title="Transaction not found">
    <p class="text-cladd-fg-soft">
      {groupQuery.error?.message ?? "This transaction does not exist."}
    </p>
  </Box>
{:else}
  <div class="flex flex-col gap-3">
    <section class="cladd-surface cladd-outline min-w-0 rounded-cladd-lg">
      <div class="flex flex-col gap-2.5 px-4 pt-3.5 pb-4 sm:px-5">
        <div
          class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-cladd-fg-soft"
        >
          <TypeIcon {type} />
          <span>{TYPE_LABEL[type] ?? type}</span>
          <span class="text-cladd-fg-softer">·</span>
          {@render cell("date", 0)}
          {#if splits.some((split) => split.reconciled)}
            <span class="text-cladd-fg-softer">·</span>
            <span class="inline-flex items-center gap-1 text-income"
              ><Check class="size-3.5" />reconciled</span
            >
          {/if}
          {#if deleteError}
            <span class="text-expense" role="alert">{deleteError}</span>
          {/if}
        </div>

        <div
          class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1"
        >
          <div
            class="min-w-0 flex-1 basis-full font-semibold text-[20px] text-cladd-fg leading-tight tracking-[-0.01em] sm:basis-0"
          >
            {#if many}
              {title}
            {:else}
              {@render cell("description", 0)}
            {/if}
          </div>
          <div
            class="flex flex-wrap items-baseline gap-x-3 font-semibold text-[28px] leading-none tracking-[-0.02em]"
          >
            {#if many}
              {#each sumByCurrency(splits) as sum (sum.code)}
                {@render money(sum)}
              {/each}
              {#each foreignTotals as sum (sum.code)}
                <span class="num font-medium text-[15px] text-cladd-fg-soft"
                  >{formatMoney(sum)}</span
                >
              {/each}
              {#if totalApprox}
                <span class="num font-medium text-[15px] text-cladd-fg-soft"
                  >{totalApprox}</span
                >
              {/if}
            {:else}
              {@render cell("amount", 0)}
            {/if}
          </div>
        </div>

        <div
          class="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1"
        >
          <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            {#if many && counterSide === "source"}
              {@render account(first, "source")}
              {#if splits.some((s) => s.source_id !== first.source_id)}
                <span class="text-cladd-fg-soft">and others</span>
              {/if}
            {:else}
              {@render cell("source", 0)}
            {/if}
            <span class="text-cladd-fg-softer">→</span>
            {#if many && counterSide === "destination"}
              {@render account(first, "destination")}
              {#if splits.some(
                (s) => s.destination_id !== first.destination_id
              )}
                <span class="text-cladd-fg-soft">and others</span>
              {/if}
            {:else}
              {@render cell("destination", 0)}
            {/if}
          </div>
          {#if balances.length}
            <div class="text-cladd-fg-soft">
              {balances.length > 1 ? "balances after" : "balance after"}
              <span class="num font-medium text-cladd-fg"
                >{balances.join(", ")}</span
              >
            </div>
          {/if}
        </div>

        {#if !many}
          {@render classes(first, 0)}
        {/if}
      </div>

      {#if !many}
        <div
          class="border-cladd-outline border-t px-4 py-3 text-[14px] leading-relaxed sm:px-5"
        >
          {@render cell("notes", 0)}
        </div>
      {:else}
        <ol>
          {#each splits as split, index (journalId(split))}
            <li
              class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 border-cladd-outline border-t px-4 py-3 sm:px-5"
            >
              <span class="num pt-px text-cladd-fg-softer">{index + 1}</span>
              <div class="flex min-w-0 flex-col gap-1.5">
                <div
                  class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"
                >
                  <div class="min-w-0 flex-1 font-semibold text-cladd-fg">
                    {@render cell("description", index)}
                  </div>
                  <div class="font-semibold text-[15px]">
                    {@render cell("amount", index)}
                  </div>
                </div>
                {#if counterSide}
                  <div class="flex flex-wrap items-baseline gap-x-1.5">
                    <span class="text-cladd-fg-soft"
                      >{counterSide === "destination" ? "to" : "from"}</span
                    >
                    {@render cell(counterSide, index)}
                  </div>
                {/if}
                {@render classes(split, index)}
                <div class="text-[14px] leading-relaxed">
                  {@render cell("notes", index)}
                </div>
              </div>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    <Context {group} />

    <Extras {id} {splits} />

    <p
      class="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-cladd-fg-softer"
    >
      <span class="num">transaction #{id}</span>
      <span class="num"
        >{splits.length > 1 ? "journals" : "journal"}
        {splits.map((split) => `#${journalId(split)}`).join(", ")}</span
      >
      {#if group.attributes.created_at}
        <span>created {formatDateTime(group.attributes.created_at)}</span>
      {/if}
      {#if group.attributes.updated_at &&
        group.attributes.updated_at !== group.attributes.created_at}
        <span>updated {formatDateTime(group.attributes.updated_at)}</span>
      {/if}
    </p>
  </div>
{/if}
