<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { onMount, tick } from "svelte";
  import { ApiError, api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { One, Split, TransactionGroup } from "#lib/api/types.js";
  import { Catalog } from "#lib/components/editor/catalog.svelte.js";
  import { setDraft } from "#lib/components/editor/draft.js";
  import {
    type Form,
    KINDS,
    TYPE_LABEL,
    toPayload,
    validate,
  } from "#lib/components/editor/model.js";
  import {
    complete,
    counterpartyKinds,
    type Marker,
    markerValue,
    parseQuick,
    resolveQuick,
    type Segment,
    segmentAt,
    sidesOf,
    tagsOf,
  } from "#lib/components/editor/quick.js";
  import type { Option } from "#lib/components/inputs/AutocompleteInput.svelte";
  import { evalAmount } from "#lib/components/inputs/parse.js";
  import { LIST } from "#lib/components/inputs/styles.js";
  import { today } from "#lib/dates.js";
  import { formatDate, formatMoney } from "#lib/format.js";
  import { prettyKeys } from "#lib/keys.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { goto } from "$app/navigation";

  const SUGGESTIONS = 6;
  const HINT =
    "12.50 lunch @payee ^account !category $budget %subscription #tag ~yesterday · + in front for a deposit · >account for a transfer · 12.50 USD =520 UAH for another currency";

  const catalog = new Catalog();
  let input = $state<HTMLInputElement | null>(null);
  let text = $state("");
  let caret = $state(0);
  let active = $state(-1);
  let saving = $state(false);
  let message = $state<{ tone: "ok" | "error"; text: string } | null>(null);
  let saved = $state<{ id: string; text: string } | null>(null);
  let recent = $state<Record<string, Split | null>>({});

  const quick = $derived(parseQuick(text));
  const own = $derived(sidesOf(quick.type).own);
  const other = $derived(sidesOf(quick.type).other);
  const segment = $derived(segmentAt(quick, text, caret));

  function optionsFor(at: Segment | null): Option[] {
    if (!at) {
      return [];
    }
    const query = at.value.trim();
    const lists: Record<Marker, () => Option[]> = {
      "!": () => catalog.categoryOptions(query),
      "@": () => catalog.accountOptions(KINDS[quick.type][other], query),
      "#": () => catalog.tagOptions(query, tagsOf(quick)),
      "%": () => catalog.billOptions(query),
      "^": () => catalog.accountOptions(KINDS[quick.type][own], query),
      ">": () => catalog.accountOptions(KINDS.transfer.destination, query),
      "~": () => [],
      $: () => catalog.budgetOptions(query),
    };
    const found = lists[at.marker]().slice(0, SUGGESTIONS);
    const done =
      found.length === 1 &&
      found[0].label.toLowerCase() === query.toLowerCase() &&
      text.slice(0, caret).endsWith(" ");
    return done ? [] : found;
  }

  const suggestions = $derived(optionsFor(segment));

  const resolved = $derived(resolveQuick(quick, catalog, recent));

  const errors = $derived(validate(resolved.form));
  const allProblems = $derived([
    ...(quick.amount === null ? ["Start with an amount, like 12.50"] : []),
    ...resolved.problems,
    ...Object.entries(errors)
      .filter(([key]) => !key.endsWith(".amount"))
      .map(([, value]) => value[0]),
  ]);

  $effect(() => {
    const name = markerValue(quick, "@");
    const found = name
      ? catalog.findAccount(counterpartyKinds(quick.type), name)
      : undefined;
    if (!found || found.id in recent || quick.type === "transfer") {
      return;
    }
    const side = other;
    catalog.lastFor(found.id, side, quick.type).then((past) => {
      recent = { ...recent, [found.id]: past?.split ?? null };
    });
  });

  onMount(() => {
    input?.focus();
  });

  function money(form: Form) {
    const [split] = form.splits;
    const main = formatMoney({
      ...split.currency,
      amount: evalAmount(split.amount) ?? 0,
    });
    if (!split.foreignCurrency) {
      return main;
    }
    const foreign = formatMoney({
      ...split.foreignCurrency,
      amount: evalAmount(split.foreignAmount) ?? 0,
    });
    return `${main} (${foreign})`;
  }

  function syncCaret() {
    caret = input?.selectionStart ?? text.length;
  }

  async function accept(option: Option) {
    if (!segment) {
      return;
    }
    const next = complete(text, segment, option.label);
    ({ text } = next);
    active = -1;
    await tick();
    input?.setSelectionRange(next.caret, next.caret);
    ({ caret } = next);
  }

  async function save() {
    if (saving) {
      return;
    }
    if (allProblems.length) {
      message = { text: allProblems[0], tone: "error" };
      return;
    }
    saving = true;
    message = null;
    const { form } = resolved;
    const [split] = form.splits;
    try {
      const result = await api<One<TransactionGroup>>("/v1/transactions", {
        body: toPayload(form, false, { applyRules: true, fireWebhooks: true }),
        method: "POST",
      });
      const target = split[other].name || "(cash)";
      saved = {
        id: result.data.id,
        text: `${split.description} ${money(form)} ${own === "source" ? "→" : "←"} ${target}`,
      };
      text = "";
      caret = 0;
      await invalidate();
    } catch (error) {
      message = {
        text:
          error instanceof ApiError
            ? (Object.values(error.errors)[0]?.[0] ?? error.message)
            : String(error),
        tone: "error",
      };
    } finally {
      saving = false;
    }
  }

  async function undo() {
    if (!saved) {
      return;
    }
    const { id, text: label } = saved;
    saved = null;
    await api(`/v1/transactions/${id}`, { method: "DELETE" });
    message = { text: `Deleted ${label}`, tone: "ok" };
    await invalidate();
    input?.focus();
  }

  function openEditor() {
    setDraft($state.snapshot(resolved.form) as Form);
    ui.quickEntry = false;
    goto(`/transactions/create/${quick.type}?draft=${Date.now()}`);
  }

  function handleKey(event: KeyboardEvent) {
    const mod = event.ctrlKey || event.metaKey;
    const count = suggestions.length;
    if (event.key === "Enter" && mod) {
      event.preventDefault();
      openEditor();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && suggestions[active]) {
        accept(suggestions[active]);
      } else {
        save();
      }
    } else if (event.key === "Tab" && count && !event.shiftKey) {
      event.preventDefault();
      accept(suggestions[Math.max(active, 0)]);
    } else if (
      count &&
      (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n"))
    ) {
      event.preventDefault();
      active = (active + 1) % count;
    } else if (
      count &&
      (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p"))
    ) {
      event.preventDefault();
      active = (active - 1 + count) % count;
    } else if (event.key === "Escape" && count) {
      event.preventDefault();
      caret = -1;
    }
  }

  const accountLabel = (value: Form["splits"][number]["source"]) => {
    if (!value.name) {
      return "(cash)";
    }
    return value.id ? value.name : `${value.name} (new)`;
  };

  const preview = $derived.by(() => {
    const { form, fromPast } = resolved;
    const [split] = form.splits;
    const last = (yes: boolean) => (yes ? " (last time)" : "");
    const parts: { text: string; tone?: string }[] = [
      {
        text: TYPE_LABEL[quick.type],
        tone: `font-semibold ${tone(quick.type)}`,
      },
      {
        text: quick.amount === null ? "no amount yet" : money(form),
        tone: "num font-semibold text-cladd-fg",
      },
      {
        text: `${accountLabel(split.source)} → ${accountLabel(split.destination)}`,
      },
      { text: `"${split.description}"`, tone: "text-cladd-fg" },
    ];
    if (split.category) {
      const fresh = catalog.findCategory(split.category) ? "" : " (new)";
      parts.push({
        text: `category ${split.category}${fresh}${last(fromPast.category)}`,
      });
    }
    if (split.bill.id) {
      parts.push({ text: `subscription ${split.bill.name}` });
    }
    if (split.budget.id) {
      parts.push({
        text: `budget ${split.budget.name}${last(fromPast.budget)}`,
      });
    }
    if (split.tags.length) {
      parts.push({ text: split.tags.map((tag) => `#${tag}`).join(" ") });
    }
    if (form.date !== today()) {
      parts.push({ text: formatDate(form.date, "day") });
    }
    return parts;
  });

  const tone = (kind: string) =>
    ({
      deposit: "text-income",
      transfer: "text-transfer",
      withdrawal: "text-expense",
    })[kind] ?? "";
</script>

<div
  class="border-cladd-outline border-b bg-cladd-surface px-4 py-2.5 text-[13px] lg:px-6"
>
  <div class="mx-auto flex w-full max-w-[1920px] flex-col gap-1.5">
    <div class="flex items-center gap-2">
      <label
        class="hidden shrink-0 font-semibold text-cladd-fg-soft sm:block"
        for="quick-entry"
        >Quick entry</label
      >
      <div class="relative min-w-0 flex-1">
        <input
          aria-autocomplete="list"
          aria-controls="quick-entry-list"
          aria-expanded={suggestions.length > 0}
          aria-label="Quick entry"
          autocomplete="off"
          class="cladd-cut cladd-focusable-input h-10 w-full rounded-cladd-md px-3 font-mono text-[16px] text-cladd-fg placeholder:font-sans placeholder:text-cladd-fg-softer sm:h-9 sm:text-[14px]"
          enterkeyhint="send"
          id="quick-entry"
          onclick={syncCaret}
          oninput={() => {
            syncCaret();
            active = -1;
            saved = null;
            message = null;
          }}
          onkeydown={handleKey}
          onkeyup={(event) => {
            if (event.key.startsWith("Arrow") && !suggestions.length) {
              syncCaret();
            }
          }}
          placeholder="12.50 lunch @Costa Coffee !Eating out #work"
          role="combobox"
          spellcheck="false"
          bind:this={input}
          bind:value={text}
        >
        {#if suggestions.length}
          <div class={LIST} id="quick-entry-list" role="listbox">
            {#each suggestions as option, index (option.id)}
              <div
                aria-selected={index === active}
                class="flex cursor-pointer items-baseline gap-2 px-2.5 py-1.5 sm:py-1 {index ===
                active
                  ? "bg-row-cursor"
                  : "hover:bg-row-hover"}"
                onmousedown={(event) => {
                  event.preventDefault();
                  accept(option);
                }}
                role="option"
                tabindex="-1"
              >
                <span class="min-w-0 flex-1 truncate">{option.label}</span>
                {#if option.hint}
                  <span class="num text-[12px] text-cladd-fg-soft"
                    >{option.hint}</span
                  >
                {/if}
                {#if option.meta}
                  <span class="text-[11px] text-cladd-fg-softer"
                    >{option.meta}</span
                  >
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <button
        class="cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-color-brand inline-flex h-10 items-center gap-1.5 rounded-cladd-md px-3 font-semibold text-[12px] text-cladd-primary sm:h-9"
        disabled={saving}
        onclick={save}
        type="button"
      >
        Save <span class="kbd hidden sm:inline-flex">↵</span>
      </button>
      <button
        class="cladd-surface cladd-gradient cladd-outline cladd-hoverable hidden h-9 items-center gap-1.5 rounded-cladd-md px-3 font-semibold text-[12px] text-cladd-fg sm:inline-flex"
        onclick={openEditor}
        type="button"
      >
        Editor <span class="kbd">{prettyKeys("mod+Enter")[0]}</span>
      </button>
      <button
        aria-label="Close quick entry"
        class="grid size-9 shrink-0 place-items-center rounded-cladd-md text-cladd-fg-soft hover:bg-cladd-surface-next hover:text-cladd-fg"
        onclick={() => (ui.quickEntry = false)}
        type="button"
      >
        <X class="size-4" />
      </button>
    </div>
    <div
      class="flex min-h-5 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:pl-[5.6rem]"
    >
      {#if saved}
        <span class="text-income" role="status">Saved: {saved.text}</span>
        <button class="text-brand hover:underline" onclick={undo} type="button">
          Undo
        </button>
        <span class="text-cladd-fg-softer">·</span>
        <a
          class="text-brand hover:underline"
          href="/transactions/show/{saved.id}"
          >Open</a
        >
      {:else if message}
        <span
          class={message.tone === "error"
            ? "text-expense"
            : "text-cladd-fg-soft"}
          role="status"
          >{message.text}</span
        >
      {:else if text.trim()}
        {#each preview as part, index (index)}
          {#if index}
            <span class="text-cladd-fg-softer">·</span>
          {/if}
          <span class={part.tone ?? "text-cladd-fg-soft"}>{part.text}</span>
        {/each}
        {#if allProblems.length}
          <span class="text-expense">· {allProblems[0]}</span>
        {/if}
      {:else}
        <span class="text-cladd-fg-soft">{HINT}</span>
      {/if}
    </div>
  </div>
</div>
