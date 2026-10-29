<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Account, AccountType, Item, Page } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import Sparkline from "#lib/components/charts/Sparkline.svelte";
  import {
    balanceRange,
    byCurrency,
    type ChartSet,
    seriesPoints,
  } from "#lib/components/dashboard/data.js";
  import Money from "#lib/components/Money.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { daysBetween } from "#lib/dates.js";
  import { formatDate, toNumber } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    DIRECTION_LABEL,
    editUrl,
    formatIban,
    go,
    LIABILITY_LABEL,
    openOld,
    PERIOD_LABEL,
    ROLE_LABEL,
    reconcileUrl,
    showUrl,
    TYPE_ONE,
    TYPE_TITLE,
  } from "./links.js";

  type Key =
    | "name"
    | "role"
    | "liability"
    | "direction"
    | "interest"
    | "number"
    | "balance"
    | "due"
    | "active"
    | "activity"
    | "trend"
    | "difference";

  interface Column {
    key: Key;
    label: string;
    num?: boolean;
    wide?: boolean;
  }

  const COLUMNS: Record<Key, Column> = {
    active: { key: "active", label: "Is active?", wide: true },
    activity: { key: "activity", label: "Last activity", wide: true },
    balance: { key: "balance", label: "Current balance", num: true },
    difference: {
      key: "difference",
      label: "Balance difference",
      num: true,
      wide: true,
    },
    direction: { key: "direction", label: "Liability in/out", wide: true },
    due: { key: "due", label: "Amount due", num: true, wide: true },
    interest: { key: "interest", label: "Interest (period)", wide: true },
    liability: { key: "liability", label: "Type of liability", wide: true },
    name: { key: "name", label: "Name" },
    number: { key: "number", label: "Account number", wide: true },
    role: { key: "role", label: "Role", wide: true },
    trend: { key: "trend", label: "In this period", num: true, wide: true },
  };

  const LAYOUT: Record<AccountType, Key[]> = {
    asset: [
      "name",
      "role",
      "number",
      "balance",
      "active",
      "activity",
      "trend",
      "difference",
    ],
    expense: ["name", "number", "balance", "active", "activity", "difference"],
    liabilities: [
      "name",
      "liability",
      "direction",
      "interest",
      "number",
      "balance",
      "due",
      "active",
      "trend",
      "difference",
    ],
    revenue: ["name", "number", "balance", "active", "activity", "difference"],
  };

  let { type, active = true }: { type: AccountType; active?: boolean } =
    $props();

  let filterInput = $state<HTMLInputElement>();
  let filter = $state(page.url.searchParams.get("filter") ?? "");
  let menu = $state<Item<Account> | null>(null);
  let armed = $state(false);
  let failure = $state("");

  const ROLE_RANK: Record<string, number> = {
    cashWalletAsset: 0,
    ccAsset: 1,
    defaultAsset: 2,
    savingAsset: 4,
    sharedAsset: 3,
  };
  const perCurrency = $derived(type === "asset" && active);
  const showInactive = $derived(
    perCurrency && page.url.searchParams.has("inactive")
  );

  const accounts = createQuery(() => ({
    placeholderData: keepPreviousData,
    queryFn: () =>
      all<Account>("/v1/accounts", {
        ...balanceRange(period.start, period.end),
        ...(showInactive ? {} : { active: String(active) }),
        type,
      }),
    queryKey: [
      "accounts-index",
      type,
      showInactive ? "all" : active,
      period.start,
      period.end,
    ],
  }));
  const others = createQuery(() => ({
    queryFn: () =>
      api<Page<Account>>("/v1/accounts", {
        query: { active: String(!active), limit: 1, type },
      }),
    queryKey: ["accounts-count", type, !active],
  }));
  const charted = $derived(
    (type === "asset" || type === "liabilities") && active
      ? (accounts.data ?? []).map((item) => item.id)
      : []
  );
  const trendChart = createQuery(() => ({
    enabled: charted.length > 0 && period.start < period.end,
    queryFn: () =>
      api<ChartSet[]>("/v1/chart/account/overview", {
        query: {
          "accounts[]": charted,
          end: period.end,
          period: daysBetween(period.start, period.end) > 92 ? "1W" : "1D",
          start: period.start,
        },
      }),
    queryKey: ["accounts-trend", charted.join(","), period.start, period.end],
  }));
  const trends = $derived(
    new Map(
      (trendChart.data ?? []).map((set) => [
        set.label,
        seriesPoints(set, false).map((p) => p.y),
      ])
    )
  );
  const otherCount = $derived(others.data?.meta.pagination?.total ?? 0);

  const numbered = $derived(
    (accounts.data ?? []).some((item) => formatIban(item.attributes))
  );
  const columns = $derived(
    LAYOUT[type]
      .filter((k) => k !== "number" || numbered)
      .map((k) => COLUMNS[k])
  );
  const sortParam = $derived(page.url.searchParams.get("sort") ?? "");
  const sortKey = $derived(sortParam.replace("-", "") as Key | "");
  const descending = $derived(sortParam.startsWith("-"));

  function sortValue(item: Item<Account>, key: Key): string | number {
    const a = item.attributes;
    const shown = (value: string | null | undefined) =>
      display.convert(toNumber(value), a.currency_code) ?? toNumber(value);
    switch (key) {
      case "name":
        return a.name.toLowerCase();
      case "role":
        return ROLE_LABEL[a.account_role ?? ""] ?? "";
      case "liability":
        return a.liability_type ?? "";
      case "direction":
        return a.liability_direction ?? "";
      case "interest":
        return toNumber(a.interest);
      case "number":
        return formatIban(a);
      case "balance":
        return shown(a.current_balance);
      case "due":
        return shown(a.debt_amount);
      case "active":
        return a.active ? 1 : 0;
      case "activity":
        return a.last_activity ?? "";
      default:
        return shown(a.balance_difference);
    }
  }

  const needle = $derived(filter.trim().toLowerCase());
  const matching = $derived(
    (accounts.data ?? []).filter((item) => {
      if (!needle) {
        return true;
      }
      const a = item.attributes;
      return [
        a.name,
        a.iban,
        a.account_number,
        ROLE_LABEL[a.account_role ?? ""],
      ]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle));
    })
  );
  const sorted = $derived.by(() => {
    const list = [...matching];
    if (!sortKey) {
      const rank = (item: Item<Account>) =>
        perCurrency ? (ROLE_RANK[item.attributes.account_role ?? ""] ?? 5) : 0;
      return list.sort(
        (x, y) =>
          rank(x) - rank(y) ||
          (x.attributes.order ?? 0) - (y.attributes.order ?? 0)
      );
    }
    const dir = descending ? -1 : 1;
    return list.sort((x, y) => {
      const a = sortValue(x, sortKey);
      const b = sortValue(y, sortKey);
      if (a === b) {
        return 0;
      }
      return (a > b ? 1 : -1) * dir;
    });
  });
  interface Total {
    balance: number;
    code: string;
    decimals: number;
    difference: number;
    due: number;
    symbol: string;
  }
  const totals = $derived.by(() => {
    const map = new Map<string, Total>();
    for (const { attributes: a } of matching) {
      const code = a.currency_code ?? "";
      const t = map.get(code) ?? {
        balance: 0,
        code,
        decimals: a.currency_decimal_places ?? 2,
        difference: 0,
        due: 0,
        symbol: a.currency_symbol ?? code,
      };
      t.balance += toNumber(a.current_balance);
      t.difference += toNumber(a.balance_difference);
      t.due += toNumber(a.debt_amount);
      map.set(code, t);
    }
    return [...map.values()];
  });
  const parts = (list: Total[], key: "balance" | "difference" | "due") =>
    list.map((t) => ({ ...t, amount: t[key] }));
  const merged = $derived(display.total(parts(totals, "balance")) !== null);
  const sections = $derived(perCurrency && !merged);

  const grouped = $derived(
    sections || sorted.some((item) => item.attributes.object_group_title)
  );
  const groups = $derived.by(() => {
    if (sections) {
      return byCurrency(
        sorted,
        (item) => item.attributes.currency_code ?? ""
      ).map(([code, items]) => ({ items, title: code }));
    }
    if (!grouped) {
      return [{ items: sorted, title: "" }];
    }
    const map = new Map<string, { items: Item<Account>[]; order: number }>();
    for (const item of sorted) {
      const name = item.attributes.object_group_title ?? "";
      const entry = map.get(name) ?? {
        items: [],
        order: name ? (item.attributes.object_group_order ?? 0) : 1e9,
      };
      entry.items.push(item);
      map.set(name, entry);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, entry]) => ({
        items: entry.items,
        title: name || "Without group",
      }));
  });
  const rows = $derived(groups.flatMap((g) => g.items));
  const index = $derived(new Map(rows.map((item, i) => [item.id, i])));

  const title = $derived(
    active ? TYPE_TITLE[type] : `${TYPE_TITLE[type]} (inactive)`
  );
  const createHref = $derived(`/accounts/create/${type}`);

  const nav = new ListNav<Item<Account>>({
    edit: (item) => goto(editUrl(item.id)),
    extra: () => [
      {
        group: "Accounts",
        keys: "/",
        label: "Filter accounts",
        run: () => filterInput?.focus(),
      },
      {
        group: "Accounts",
        keys: "c",
        label: `Create a new ${TYPE_ONE[type]}`,
        run: () => goto(createHref),
      },
      {
        group: "Accounts",
        keys: "r",
        label: "Reconcile account",
        run: () => {
          if (nav.current && type === "asset") {
            go(reconcileUrl(nav.current.id));
          }
        },
      },
      ...(perCurrency
        ? [
            {
              group: "Accounts",
              keys: "i",
              label: showInactive
                ? "Hide inactive accounts"
                : "Show inactive accounts",
              run: () => goto(inactiveHref(), { replace: true }),
            },
          ]
        : []),
    ],
    id: "accounts",
    items: () => rows,
    key: (item) => item.id,
    open: (item) => goto(showUrl(item.id)),
  });
  nav.use();

  function inactiveHref() {
    const url = new URL(page.url.href);
    if (showInactive) {
      url.searchParams.delete("inactive");
    } else {
      url.searchParams.set("inactive", "1");
    }
    url.searchParams.set("start", period.start);
    url.searchParams.set("end", period.end);
    return url.pathname + url.search;
  }

  function onfilterkey(event: KeyboardEvent) {
    if (event.key === "Escape" && filter) {
      filter = "";
      onfilter();
    } else if (event.key === "Enter" && rows[0]) {
      event.preventDefault();
      goto(showUrl(rows[0].id));
    }
  }

  function ariaSort(key: Key) {
    if (sortKey !== key) {
      return;
    }
    return descending ? "descending" : "ascending";
  }

  function sortHref(key: Key): string {
    const url = new URL(page.url.href);
    let next: string | null = key;
    if (sortKey === key) {
      next = descending ? null : `-${key}`;
    }
    if (next) {
      url.searchParams.set("sort", next);
    } else {
      url.searchParams.delete("sort");
    }
    url.searchParams.set("start", period.start);
    url.searchParams.set("end", period.end);
    return url.pathname + url.search;
  }

  function onfilter() {
    const url = new URL(page.url.href);
    if (filter) {
      url.searchParams.set("filter", filter);
    } else {
      url.searchParams.delete("filter");
    }
    url.searchParams.set("start", period.start);
    url.searchParams.set("end", period.end);
    nav.cursor = -1;
    goto(url, { replace: true, shallow: true, state: page.state });
  }

  function oncontextmenu(event: MouseEvent) {
    const tr = (event.target as Element).closest("tr[data-id]");
    armed = false;
    menu = rows.find((r) => r.id === tr?.getAttribute("data-id")) ?? null;
    if (menu) {
      nav.cursor = index.get(menu.id) ?? -1;
    }
  }

  async function remove(item: Item<Account>) {
    failure = "";
    try {
      await api(`/v1/accounts/${item.id}`, { method: "DELETE" });
      await invalidate();
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
  }

  function money(a: Account, value: string | number | null | undefined) {
    return {
      amount: value,
      code: a.currency_code,
      decimals: a.currency_decimal_places,
      symbol: a.currency_symbol,
    };
  }

  function rowClass(i: number) {
    if (nav.cursor === i) {
      return "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]";
    }
    return "hover:bg-row-hover";
  }
</script>

{#snippet sums(
  list: Total[],
  label: string,
  head = false
)}
  {#each columns as col, c (col.key)}
    <td
      class="px-3 {col.num ? "text-right" : ""} {col.wide
        ? "hidden md:table-cell"
        : ""}"
    >
      {#if c === 0}
        <span
          class="font-semibold text-[12px] {head
            ? "text-cladd-fg"
            : "text-cladd-fg-soft"}"
          >{label}</span
        >
        {#if head}
          <Money
            class="ml-2 text-[12px] md:hidden"
            inline
            parts={parts(list, "difference")}
            signed
          />
        {/if}
      {:else if col.key === "balance"}
        <span class="num font-semibold"
          >{display.text(parts(list, "balance"))}</span
        >
      {:else if col.key === "due"}
        <span class="num font-semibold"
          >{display.text(parts(list, "due"))}</span
        >
      {:else if col.key === "difference"}
        <Money class="font-semibold" parts={parts(list, "difference")} />
      {/if}
    </td>
  {/each}
{/snippet}

<PageHeader
  crumbs={[{ label: title }]}
  subtitle={active ? undefined : "Archive"}
  title="Accounts"
>
  {#snippet actions()}
    <a
      class="cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-color-green inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-[12px] text-cladd-primary"
      href={createHref}
      title="Create a new {TYPE_ONE[type]}  c"
    >
      <Plus class="size-3.5" />
      Create a new {TYPE_ONE[type]}
    </a>
  {/snippet}
</PageHeader>

<Box body="p-0" {title}>
  {#snippet tools()}
    <input
      aria-label="Filter accounts"
      class="cladd-cut h-7 w-44 rounded-cladd-sm px-2 text-[12px] outline-none placeholder:text-cladd-fg-softer sm:w-60"
      oninput={onfilter}
      onkeydown={onfilterkey}
      placeholder="Filter  /"
      type="search"
      bind:this={filterInput}
      bind:value={filter}
    >
  {/snippet}
  {#if accounts.isPending}
    <div class="h-40"></div>
  {:else if accounts.isError}
    <p class="p-3 text-expense">{accounts.error.message}</p>
  {:else if (accounts.data?.length ?? 0) === 0}
    <div class="flex flex-col items-center gap-3 px-3 py-10 text-center">
      <p class="font-semibold text-[15px]">
        {active
          ? `No ${TYPE_TITLE[type].toLowerCase()} yet`
          : "Nothing archived"}
      </p>
      {#if active}
        <a
          class="text-brand dark:text-(--ff-series-1) underline"
          href={createHref}
          >Create a new {TYPE_ONE[type]}</a
        >
      {/if}
    </div>
  {:else}
    <ContextMenu>
      <ContextMenuTrigger class="block overflow-x-auto" {oncontextmenu}>
        <table
          class="w-full md:min-w-[720px] border-collapse text-[13px] transition-opacity {accounts.isPlaceholderData
            ? "opacity-60"
            : ""}"
        >
          <thead class="border-cladd-outline border-b text-left">
            <tr class="h-8">
              {#each columns as col (col.key)}
                <th
                  aria-sort={ariaSort(col.key)}
                  class="whitespace-nowrap px-3 font-semibold text-[12px] text-cladd-fg-soft {col.num
                    ? "text-right"
                    : ""} {col.wide ? "hidden md:table-cell" : ""}"
                  scope="col"
                >
                  <a
                    class="inline-flex items-center gap-1 hover:text-cladd-fg"
                    href={sortHref(col.key)}
                    >{col.label}
                    {#if sortKey === col.key}
                      {#if descending}
                        <ArrowDown class="size-3" />
                      {:else}
                        <ArrowUp class="size-3" />
                      {/if}
                    {/if}
                  </a>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each groups as group (group.title)}
              {#if sections}
                <tr class="h-8 border-cladd-outline border-t-2">
                  {@render sums(
                    totals.filter((t) => t.code === group.title),
                    group.title,
                    true
                  )}
                </tr>
              {:else if grouped}
                <tr class="h-8 border-cladd-outline border-t">
                  <th
                    class="px-3 text-left font-semibold text-[12px] text-cladd-fg"
                    colspan={columns.length}
                    scope="rowgroup"
                  >
                    {group.title}
                  </th>
                </tr>
              {/if}
              {#each group.items as item (item.id)}
                {@const a = item.attributes}
                {@const i = index.get(item.id) ?? -1}
                <tr
                  class="h-7 border-cladd-outline/60 border-t {rowClass(
                    i
                  )} {a.active ? "" : "opacity-60"}"
                  data-id={item.id}
                  id={nav.rowId(i)}
                  onclick={(event) => nav.click(i, event)}
                >
                  {#each columns as col (col.key)}
                    <td
                      class="px-3 {col.key === "name"
                        ? ""
                        : "whitespace-nowrap"} {col.num
                        ? "text-right"
                        : ""} {col.wide ? "hidden md:table-cell" : ""}"
                    >
                      {#if col.key === "name"}
                        <a
                          class="block max-w-[22rem] truncate text-brand dark:text-(--ff-series-1) hover:underline"
                          href={showUrl(item.id)}
                          title={a.name}
                          >{a.name}</a
                        >
                      {:else if col.key === "role"}
                        {ROLE_LABEL[a.account_role ?? ""] ?? ""}
                      {:else if col.key === "liability"}
                        {LIABILITY_LABEL[a.liability_type ?? ""] ?? ""}
                      {:else if col.key === "direction"}
                        {DIRECTION_LABEL[a.liability_direction ?? ""] ?? ""}
                      {:else if col.key === "interest"}
                        <span class="num">{toNumber(a.interest)}%</span>
                        <span class="text-cladd-fg-soft"
                          >({PERIOD_LABEL[a.interest_period ?? ""] ??
                            a.interest_period})</span
                        >
                      {:else if col.key === "number"}
                        <span class="num text-[12px] text-cladd-fg-soft"
                          >{formatIban(a)}</span
                        >
                      {:else if col.key === "balance"}
                        <Amount {...money(a, a.current_balance)} />
                      {:else if col.key === "due"}
                        <Amount {...money(a, a.debt_amount)} tone="transfer" />
                      {:else if col.key === "active"}
                        {#if a.active}
                          <Check aria-label="Active" class="size-3.5" />
                        {:else}
                          <X
                            aria-label="Inactive"
                            class="size-3.5 text-cladd-fg-soft"
                          />
                        {/if}
                      {:else if col.key === "trend"}
                        {@const values = trends.get(a.name) ?? []}
                        <span class="flex justify-end">
                          <Sparkline
                            color={toNumber(a.balance_difference) < 0
                              ? "var(--ff-expense)"
                              : "var(--ff-income)"}
                            height={20}
                            {values}
                            width={88}
                          />
                        </span>
                      {:else if col.key === "activity"}
                        <span class="text-cladd-fg-soft"
                          >{a.last_activity
                            ? formatDate(a.last_activity.slice(0, 10))
                            : "never"}</span
                        >
                      {:else}
                        <Amount {...money(a, a.balance_difference)} />
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            {/each}
            {#if rows.length === 0}
              <tr>
                <td
                  class="px-3 py-6 text-center text-cladd-fg-soft"
                  colspan={columns.length}
                >
                  Nothing matches “{filter}”. Press Escape to clear.
                </td>
              </tr>
            {/if}
          </tbody>
          {#if totals.length > 0 && !sections}
            <tfoot class="border-cladd-outline border-t-2">
              {#if merged}
                <tr class="h-7">
                  {@render sums(totals, "Total")}
                </tr>
              {:else}
                {#each totals as t (t.code)}
                  <tr class="h-7">
                    {@render sums([t], `Total in ${t.code}`)}
                  </tr>
                {/each}
              {/if}
            </tfoot>
          {/if}
        </table>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-56">
        {#if menu}
          {@const target = menu}
          <ContextMenuItem onSelect={() => goto(showUrl(target.id))}>
            Show <ContextMenuShortcut>↵</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => goto(editUrl(target.id))}>
            Edit <ContextMenuShortcut>e</ContextMenuShortcut>
          </ContextMenuItem>
          {#if type === "asset"}
            <ContextMenuItem onSelect={() => go(reconcileUrl(target.id))}>
              Reconcile <ContextMenuShortcut>r</ContextMenuShortcut>
            </ContextMenuItem>
          {/if}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={(event) => {
              if (armed) {
                remove(target);
                return;
              }
              event.preventDefault();
              armed = true;
            }}
            variant="destructive"
          >
            {armed
              ? `Press again to delete ${target.attributes.name}`
              : "Delete"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => openOld(showUrl(target.id))}>
            Open in old UI
          </ContextMenuItem>
        {:else}
          <ContextMenuItem disabled>Right-click a row</ContextMenuItem>
        {/if}
      </ContextMenuContent>
    </ContextMenu>
  {/if}
  {#snippet footer()}
    <a
      class="text-brand dark:text-(--ff-series-1) hover:underline"
      href={createHref}
      >Create a new {TYPE_ONE[type]}</a
    >
    {#if failure}
      <span class="text-expense">{failure}</span>
    {/if}
    {#if perCurrency && (showInactive || otherCount > 0)}
      <a
        class="ml-auto text-cladd-fg-soft hover:underline"
        data-sveltekit-replacestate
        href={inactiveHref()}
        >{showInactive
          ? "Hide inactive accounts"
          : `Show ${otherCount} inactive ${otherCount === 1 ? "account" : "accounts"}`}
        <span class="kbd">i</span></a
      >
    {:else if active && otherCount > 0}
      <a
        class="ml-auto text-cladd-fg-soft hover:underline"
        href="/inactive-accounts/{type}"
        >{otherCount}
        inactive {otherCount === 1 ? "account" : "accounts"}</a
      >
    {:else if !active}
      <a
        class="ml-auto text-cladd-fg-soft hover:underline"
        href="/accounts/{type}"
        >Back to active {TYPE_TITLE[type].toLowerCase()}</a
      >
    {/if}
  {/snippet}
</Box>
