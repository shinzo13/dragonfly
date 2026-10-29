<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import { createQuery } from "@tanstack/svelte-query";
  import { lists } from "#lib/api/lists.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { keys, prettyKeys } from "#lib/keys.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { allLinks, CREATE_LINKS } from "#lib/nav.js";
  import { searches } from "#lib/transactions/searches.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { goto } from "$app/navigation";

  interface Entry {
    group: string;
    hint?: string;
    id: string;
    keys?: string;
    label: string;
    run: () => void;
  }

  const CLICKABLE =
    "a[href], button, summary, select, textarea, input:not([type='hidden']), [role='button'], [role='tab'], [role='link'], [role='menuitem']";
  const FIELD =
    "select, textarea, input:not([type='checkbox'], [type='radio'])";
  const SKIP = "tbody, [aria-hidden='true'], [inert]";
  const MAX_LABEL = 80;
  const WHITESPACE = /\s+/g;

  let dialog = $state<HTMLDialogElement>();
  let input = $state<HTMLInputElement>();
  let cursor = $state(0);
  let pageEntries = $state.raw<Entry[]>([]);

  function labelOf(element: HTMLElement): string {
    const field = element as HTMLInputElement;
    const text =
      element.getAttribute("aria-label") ||
      field.labels?.[0]?.innerText ||
      element.innerText ||
      element.getAttribute("title") ||
      field.placeholder ||
      "";
    return text.replace(WHITESPACE, " ").trim().slice(0, MAX_LABEL);
  }

  function press(element: HTMLElement, field: boolean) {
    requestAnimationFrame(() => {
      element.focus();
      if (!field) {
        element.click();
      }
    });
  }

  function scanPage(): Entry[] {
    const seen = new Set<string>();
    const found: Entry[] = [];
    const elements =
      document
        .querySelector("main")
        ?.querySelectorAll<HTMLElement>(CLICKABLE) ?? [];
    for (const element of elements) {
      const hidden =
        element.closest(SKIP) !== null ||
        element.matches(":disabled") ||
        element.getClientRects().length === 0;
      const label = hidden ? "" : labelOf(element);
      const id = `${label}|${element.getAttribute("href") ?? ""}`;
      if (!label || seen.has(id)) {
        continue;
      }
      seen.add(id);
      const field = element.matches(FIELD);
      let hint = "button";
      if (field) {
        hint = "field";
      } else if (element.matches("a")) {
        hint = "link";
      }
      found.push({
        group: "On this page",
        hint,
        id: `dom:${found.length}`,
        label,
        run: () => press(element, field),
      });
    }
    return found;
  }

  const accounts = createQuery(() => ({
    ...lists.accounts("all"),
    enabled: ui.palette,
  }));
  const budgets = createQuery(() => ({
    ...lists.budgets(),
    enabled: ui.palette,
  }));
  const categories = createQuery(() => ({
    ...lists.categories(),
    enabled: ui.palette,
  }));
  const tags = createQuery(() => ({ ...lists.tags(), enabled: ui.palette }));
  const bills = createQuery(() => ({ ...lists.bills(), enabled: ui.palette }));
  const piggies = createQuery(() => ({
    ...lists.piggyBanks(),
    enabled: ui.palette,
  }));

  function link(href: string, old = false) {
    return () => {
      if (old) {
        location.assign(href);
      } else {
        goto(href);
      }
    };
  }

  const ACCOUNT_GROUP: Record<string, string> = {
    asset: "Asset account",
    expense: "Expense account",
    liabilities: "Liability",
    revenue: "Revenue account",
  };

  function entity(
    kind: string,
    group: string,
    href: string,
    id: string,
    label: string | undefined,
    hint?: string
  ): Entry {
    return {
      group,
      hint,
      id: `${kind}:${id}`,
      label: label ?? "",
      run: link(`${href}/${id}`),
    };
  }

  const staticEntries: Entry[] = [
    ...allLinks().map((nav) => ({
      group: "Page",
      id: `page:${nav.href}`,
      keys: nav.keys,
      label: nav.label,
      run: link(nav.href, nav.old),
    })),
    ...CREATE_LINKS.map((create) => ({
      group: "Create",
      id: `create:${create.href}`,
      label: create.label,
      run: link(create.href, create.old),
    })),
  ];

  const commandEntries = $derived<Entry[]>(
    keys.all
      .filter((binding) => !binding.hidden && binding.group !== "Navigation")
      .map((binding) => ({
        group: binding.group ?? "Command",
        id: `key:${binding.keys}:${binding.label}`,
        keys: binding.keys,
        label: binding.label,
        run: () => binding.run(new KeyboardEvent("keydown")),
      }))
  );

  const entityEntries = $derived<Entry[]>([
    ...(accounts.data ?? []).map((item) =>
      entity(
        "account",
        ACCOUNT_GROUP[item.attributes.type] ?? "Account",
        "/accounts/show",
        item.id,
        item.attributes.name,
        item.attributes.active ? undefined : "inactive"
      )
    ),
    ...(budgets.data ?? []).map((item) =>
      entity("budget", "Budget", "/budgets/show", item.id, item.attributes.name)
    ),
    ...(categories.data ?? []).map((item) =>
      entity(
        "category",
        "Category",
        "/categories/show",
        item.id,
        item.attributes.name
      )
    ),
    ...(tags.data ?? []).map((item) =>
      entity("tag", "Tag", "/tags/show", item.id, item.attributes.tag)
    ),
    ...(bills.data ?? []).map((item) =>
      entity(
        "bill",
        "Subscription",
        "/subscriptions/show",
        item.id,
        item.attributes.name
      )
    ),
    ...(piggies.data ?? []).map((item) =>
      entity(
        "piggy",
        "Piggy bank",
        "/piggy-banks/show",
        item.id,
        item.attributes.name
      )
    ),
  ]);

  const searchEntries = $derived<Entry[]>(
    ui.palette
      ? searches.list().map((saved) => ({
          group: "Searches",
          hint: saved.pinned ? "pinned" : undefined,
          id: `saved:${saved.query}`,
          label: saved.label,
          run: () => searches.open(saved),
        }))
      : []
  );

  const currencyEntries = $derived<Entry[]>([
    {
      group: "Currency",
      id: "currency:own",
      label: "Show amounts in their own currencies",
      run: () => display.show(null),
    },
    ...display.options.map((currency) => ({
      group: "Currency",
      id: `currency:${currency.code}`,
      label: `Show everything in ${currency.code} (${currency.symbol})`,
      run: () => display.show(currency.code),
    })),
  ]);

  const entries = $derived([
    ...pageEntries,
    ...searchEntries,
    ...staticEntries,
    ...currencyEntries,
    ...commandEntries,
    ...entityEntries,
  ]);

  const results = $derived.by<Entry[]>(() => {
    const query = ui.paletteQuery;
    const found = fuzzyFilter(
      entries,
      query,
      (e) => `${e.label} ${e.group}`,
      60
    );
    if (query.trim()) {
      found.push({
        group: "Search",
        id: "search",
        label: `Search transactions for “${query.trim()}”`,
        run: link(`/search?search=${encodeURIComponent(query.trim())}`),
      });
    }
    return found;
  });

  $effect(() => {
    if (ui.palette && dialog && !dialog.open) {
      pageEntries = scanPage();
      cursor = 0;
      dialog.showModal();
      input?.select();
    } else if (!ui.palette && dialog?.open) {
      dialog.close();
    }
  });

  $effect(() => {
    if (ui.paletteQuery !== undefined) {
      cursor = 0;
    }
  });

  function choose(entry: Entry | undefined) {
    if (!entry) {
      return;
    }
    ui.palette = false;
    entry.run();
  }

  function move(delta: number) {
    if (results.length === 0) {
      return;
    }
    cursor = (cursor + delta + results.length) % results.length;
    document
      .getElementById(`palette-${cursor}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function onkeydown(event: KeyboardEvent) {
    const ctrl = event.ctrlKey || event.metaKey;
    if (
      event.key === "ArrowDown" ||
      (ctrl && event.key === "j") ||
      (ctrl && event.key === "n")
    ) {
      event.preventDefault();
      move(1);
    } else if (
      event.key === "ArrowUp" ||
      (ctrl && event.key === "k") ||
      (ctrl && event.key === "p")
    ) {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[cursor]);
    }
  }
</script>

<dialog
  aria-label="Command palette"
  class="cladd-surface cladd-outline m-auto mt-[12vh] w-[min(640px,calc(100vw-2rem))] rounded-cladd-panel p-0 text-cladd-fg shadow-cladd-popover backdrop:bg-black/30"
  onclose={() => (ui.palette = false)}
  bind:this={dialog}
>
  <div class="flex items-center gap-2 border-cladd-outline border-b px-4">
    <Search class="size-4 text-cladd-fg-softer" />
    <input
      aria-activedescendant={`palette-${cursor}`}
      aria-controls="palette-list"
      aria-expanded="true"
      class="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-cladd-fg-softer"
      {onkeydown}
      placeholder="Press anything on this page, go to a page, account, budget, tag, or run a command"
      role="combobox"
      bind:this={input}
      bind:value={ui.paletteQuery}
    >
    <span class="kbd">Esc</span>
  </div>
  <ul class="max-h-[56vh] overflow-y-auto p-1.5" id="palette-list">
    {#each results as entry, index (entry.id)}
      <li>
        <button
          class="flex h-9 w-full cursor-pointer items-center gap-3 rounded-cladd-md px-3 text-left {index ===
          cursor
            ? "bg-row-cursor"
            : ""}"
          id={`palette-${index}`}
          onclick={() => choose(entry)}
          onmousemove={() => (cursor = index)}
          tabindex="-1"
          type="button"
        >
          <span class="min-w-0 flex-1 truncate text-[13px]">{entry.label}</span>
          {#if entry.hint}
            <span class="text-[11px] text-cladd-fg-softer">{entry.hint}</span>
          {/if}
          <span
            class="w-28 shrink-0 text-right text-[11px] text-cladd-fg-softer"
            >{entry.group}</span
          >
          <span class="flex w-16 shrink-0 justify-end gap-1">
            {#if entry.keys}
              {#each prettyKeys(entry.keys) as key, i (i)}
                <span class="kbd">{key}</span>
              {/each}
            {/if}
          </span>
        </button>
      </li>
    {:else}
      <li class="px-3 py-6 text-center text-[13px] text-cladd-fg-soft">
        Nothing matches. Try fewer letters.
      </li>
    {/each}
  </ul>
</dialog>
