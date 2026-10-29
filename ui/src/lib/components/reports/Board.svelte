<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { lists } from "#lib/api/lists.js";
  import Lanes from "#lib/components/charts/Lanes.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { today } from "#lib/dates.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import {
    buildBoard,
    cursorOf,
    grew,
    longMonth,
    mergedLane,
    monthFacts,
    monthOf,
    monthRange,
    shiftMonth,
    spendingLanes,
  } from "#lib/reports/board.js";
  import { displayCode, displayFlows } from "#lib/reports/display.js";
  import { exchanges } from "#lib/reports/flows.js";
  import { ledgerQuery, ledgerWindow, ownFlows } from "#lib/reports/ledger.js";
  import { ALL_ASSETS, type ReportParams, ymd } from "#lib/reports/params.js";
  import {
    createReport,
    type Drill,
    drillQuery,
    navigate,
    provideReport,
  } from "#lib/reports/report.svelte.js";
  import { page } from "$app/state";
  import BoardTables from "./BoardTables.svelte";
  import CurrencyTable from "./CurrencyTable.svelte";
  import Headline from "./Headline.svelte";
  import MoneyFlow from "./MoneyFlow.svelte";
  import MonthPanel from "./MonthPanel.svelte";
  import NetWorthLanes from "./NetWorthLanes.svelte";
  import ReportBox from "./ReportBox.svelte";
  import ReportRow from "./ReportRow.svelte";
  import WhatGrew from "./WhatGrew.svelte";

  const now = today();
  const thisYear = now.slice(0, 4);
  const thisMonth = monthOf(now);

  const query = $derived(page.url.searchParams);
  const view = $derived(query.get("view") === "month" ? "month" : "year");
  const tables = $derived(query.has("tables"));
  const merged = $derived(query.has("merged"));
  const tab = $derived(query.get("tab") === "month" ? "month" : "grew");

  const cursor = $derived(cursorOf(period.range, now));
  const year = $derived(cursor.slice(0, 4));
  const anchor = $derived(year === thisYear ? now : `${year}-12-31`);
  const span = $derived(ledgerWindow(anchor));
  const first = $derived(monthOf(period.first ?? "0000-01"));

  const ledger = createQuery(() => ledgerQuery(anchor));
  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));
  const own = $derived(
    assets.data && liabilities.data
      ? [...assets.data, ...liabilities.data]
      : undefined
  );
  const ownIds = $derived(own?.map((a) => a.id) ?? []);

  const range = $derived(
    view === "month"
      ? monthRange(cursor)
      : { end: `${year}-12-31`, start: `${year}-01-01` }
  );
  const params = $derived<ReportParams>({
    accounts: ownIds,
    end: range.end,
    items: [],
    start: range.start,
    type: "default",
  });
  const mine = $derived(
    ledger.data && own ? ownFlows(ledger.data, own) : undefined
  );
  const into = $derived(
    mine ? displayCode(new Set(mine.map((flow) => flow.currency))) : null
  );
  const report = createReport(
    () => params,
    () => ledger.data,
    () => into
  );
  provideReport(report);

  const flows = $derived(mine && displayFlows(mine, into));
  const board = $derived(
    flows ? buildBoard(flows, span.months, year, report.codes, now) : undefined
  );
  const pcOk = $derived(
    !!flows &&
      flows.length > 0 &&
      flows.every((flow) => flow.pc !== null) &&
      (board?.codes.length ?? 0) > 1
  );
  const lanes = $derived.by(() => {
    if (!board) {
      return [];
    }
    return pcOk && merged ? [mergedLane(board)] : spendingLanes(board);
  });
  const swaps = $derived.by(() => {
    if (!(ledger.data && own)) {
      return [];
    }
    const currency = new Map(
      own.map((a) => [a.id, a.attributes.currency_code])
    );
    return exchanges(
      ledger.data,
      new Set(ownIds),
      (id) => currency.get(id) ?? undefined
    );
  });
  const grewRows = $derived(board ? grew(board, cursor) : []);
  const facts = $derived(board ? monthFacts(board, cursor) : []);
  const loading = $derived(!board);
  let hover = $state<string | null>(null);

  function go(month: string, drill?: Drill | null) {
    const target = monthRange(month);
    navigate({
      end: target.end,
      start: target.start,
      ...(drill === undefined ? {} : drillQuery(drill)),
    });
  }

  function clamp(month: string) {
    if (month > thisMonth) {
      return thisMonth;
    }
    return month < first ? first : month;
  }

  function move(delta: number) {
    const next = clamp(shiftMonth(cursor, delta));
    if (next !== cursor) {
      go(next);
    }
  }

  function labelFor(month: string, item = "Spent") {
    return view === "year" ? item : `${item}, ${longMonth(month)}`;
  }

  function drillFor(
    month: string,
    box: string,
    extra: Partial<Drill> = {}
  ): Drill {
    return {
      at: view === "year" ? month : undefined,
      box,
      dir: -1,
      ...extra,
      label: labelFor(month, extra.label),
    };
  }

  function openMonth(month: string, segment?: string) {
    const found = board?.catKeys.find(
      (k) => k.key === segment && k.key !== "other"
    );
    const drill = drillFor(month, "months", {
      dim: found ? "category" : undefined,
      key: found?.key,
      label: found?.label,
    });
    const same =
      report.drill?.box === "months" &&
      report.drill.key === drill.key &&
      month === cursor;
    go(month, same ? null : drill);
  }

  function setView(next: "year" | "month") {
    navigate({ ...drillQuery(null), view: next === "month" ? "month" : null });
  }

  function flag(name: string, on: boolean) {
    navigate({ [name]: on ? "1" : null });
  }

  const yearLinks = $derived.by(() => {
    const dates = `${ymd(range.start)}/${ymd(range.end)}`;
    const top = [...(board?.spending ?? [])]
      .filter((flow) => flow.other.type === "Expense account")
      .reduce((counts, flow) => {
        counts.set(flow.other.id, (counts.get(flow.other.id) ?? 0) + 1);
        return counts;
      }, new Map<string, number>());
    const busiest = [...top.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
    return [
      {
        href: `/reports/budget/${ALL_ASSETS}/allBudgets/${dates}`,
        label: "Budget report",
      },
      {
        href: `/reports/category/${ALL_ASSETS}/allCategories/${dates}`,
        label: "Category report",
      },
      {
        href: `/reports/tag/${ALL_ASSETS}/allTags/${dates}`,
        label: "Tag report",
      },
      ...(busiest.length > 0
        ? [
            {
              href: `/reports/double/${ALL_ASSETS}/${busiest.join(",")}/${dates}`,
              label: "Expense and revenue account report",
            },
          ]
        : []),
      {
        href: `/reports/audit/${ALL_ASSETS}/${dates}`,
        label: "Transaction history",
      },
      {
        href: `/reports/default/${ALL_ASSETS}/${dates}`,
        label: "Default financial report",
      },
    ];
  });

  useKeys(() => [
    {
      group: "Report",
      keys: "ArrowLeft",
      label: "Previous month",
      run: () => move(-1),
    },
    {
      group: "Report",
      keys: "ArrowRight",
      label: "Next month",
      run: () => move(1),
    },
    {
      group: "Report",
      keys: "[",
      label: "Previous year",
      run: () => move(-12),
    },
    { group: "Report", keys: "]", label: "Next year", run: () => move(12) },
    {
      group: "Report",
      keys: "Enter",
      label: "Transactions of the month",
      run: () => openMonth(cursor),
    },
    {
      group: "Report",
      keys: "m",
      label: tables ? "Hide tables by month" : "Show tables by month",
      run: () => flag("tables", !tables),
    },
    {
      group: "Report",
      keys: "g M",
      label: "Month view",
      run: () => setView("month"),
    },
    {
      group: "Report",
      keys: "g Y",
      label: "Year view",
      run: () => setView("year"),
    },
    ...(pcOk
      ? [
          {
            group: "Report",
            keys: "c",
            label: merged ? "One lane per currency" : "All in one currency",
            run: () => flag("merged", !merged),
          },
        ]
      : []),
  ]);
</script>

<PageHeader
  crumbs={[{ label: "Reports" }]}
  subtitle={view === "month" ? longMonth(cursor) : year}
  title="Reports"
>
  {#snippet actions()}
    <nav aria-label="Report period" class="flex items-center gap-3 text-[13px]">
      {#if `${Number(year) - 1}-12` >= first}
        <button
          class="text-brand hover:underline dark:text-[var(--ff-series-1)]"
          onclick={() => move(-12)}
          title="Previous year  ["
          type="button"
        >
          ‹ {Number(year) - 1}
        </button>
      {/if}
      {#if year < thisYear}
        <button
          class="text-brand hover:underline dark:text-[var(--ff-series-1)]"
          onclick={() => move(12)}
          title="Next year  ]"
          type="button"
        >
          {Number(year) + 1}
          ›
        </button>
      {/if}
      <span aria-hidden="true" class="text-cladd-fg-softest">|</span>
      {#each [
        { key: "year" as const, label: "Year", shortcut: "g Y" },
        { key: "month" as const, label: "Month", shortcut: "g M" },
      ] as item (item.key)}
        <button
          aria-pressed={view === item.key}
          class={view === item.key
            ? "font-semibold text-cladd-fg"
            : "text-brand hover:underline dark:text-[var(--ff-series-1)]"}
          onclick={() => setView(item.key)}
          title="{item.label} view  {item.shortcut}"
          type="button"
        >
          {item.label}
        </button>
      {/each}
    </nav>
  {/snippet}
</PageHeader>

{#if ledger.error}
  <p class="mb-4 text-expense">
    Firefly III did not return the transactions: {ledger.error.message}
  </p>
{/if}

<div class="flex flex-col gap-4">
  <Headline {board} month={view === "month" ? cursor : null} />

  <ReportBox
    body="px-3 pt-2 pb-3"
    empty={lanes.length === 0}
    emptyText="No spending or income in {year}."
    id="months"
    {loading}
    title={merged && pcOk
      ? "Spent each month, all in one currency"
      : "Spent each month"}
  >
    {#snippet tools()}
      {#if pcOk}
        <button
          aria-pressed={merged}
          class="text-[12px] text-brand hover:underline dark:text-[var(--ff-series-1)]"
          onclick={() => flag("merged", !merged)}
          title="Switch  c"
          type="button"
        >
          {merged ? "One lane per currency" : "All in one currency"}
        </button>
      {/if}
    {/snippet}
    <Lanes
      {cursor}
      dotLabel="earned"
      label="Spent each month by currency"
      {lanes}
      onselect={(month, _lane, segment) => openMonth(month, segment)}
      partial={board?.partial}
      pinned={view === "month"}
      title={(row) => longMonth(row.key)}
      bind:hover
    />
  </ReportBox>

  <div class="flex gap-4 text-[13px] lg:hidden" role="tablist">
    {#each [
      { key: "grew", label: "What grew" },
      { key: "month", label: longMonth(cursor) },
    ] as item (item.key)}
      <button
        aria-selected={tab === item.key}
        class={tab === item.key
          ? "font-semibold text-cladd-fg"
          : "text-brand dark:text-[var(--ff-series-1)]"}
        onclick={() => navigate({ tab: item.key === "month" ? "month" : null })}
        role="tab"
        type="button"
      >
        {item.label}
      </button>
    {/each}
  </div>

  <ReportRow class="lg:grid-cols-2">
    <WhatGrew
      class={tab === "grew" ? "" : "max-lg:hidden"}
      codes={board?.codes.length ?? 0}
      colors={board?.catKeys ?? []}
      {cursor}
      {loading}
      monthDrill={(extra) => drillFor(cursor, "grew", extra)}
      partial={cursor === board?.partial}
      rows={grewRows}
    />
    <MonthPanel
      class={tab === "month" ? "" : "max-lg:hidden"}
      {facts}
      {loading}
      month={cursor}
      monthDrill={(extra) => drillFor(cursor, "month", extra)}
      partial={cursor === board?.partial}
      swaps={swaps.filter((swap) => monthOf(swap.date) === cursor)}
      totals={view === "year"}
    />
  </ReportRow>

  {#if view === "month"}
    <MoneyFlow switcher />
  {:else if board}
    <CurrencyTable {board} {swaps} />
    <NetWorthLanes {cursor} groups={ledger.data ?? []} {own} {year} />
  {/if}

  {#if tables}
    <BoardTables {view} />
  {/if}

  <nav
    aria-label="More reports"
    class="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-cladd-fg-soft"
  >
    <button
      class="text-brand hover:underline dark:text-[var(--ff-series-1)]"
      onclick={() => flag("tables", !tables)}
      title="Tables by month  m"
      type="button"
    >
      {tables ? "Hide tables by month" : "Tables by month"}
    </button>
    {#each yearLinks as link (link.href)}
      <a
        class="text-brand hover:underline dark:text-[var(--ff-series-1)]"
        href={link.href}
        >{link.label}</a
      >
    {/each}
  </nav>
</div>
