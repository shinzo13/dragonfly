<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Budget, One } from "#lib/api/types.js";
  import { learnedBudgets } from "#lib/budgets/map.js";
  import {
    type Place,
    placesOf,
    refreshExcept,
    type Scope,
    withoutBudget,
  } from "#lib/budgets/triage.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import {
    averages,
    type BudgetRow,
    buildPools,
    buildRows,
    curOf,
    isOpen,
    type Line,
    lineMoney,
    loadBudgetPage,
    mergeLines,
    pace,
    projection,
    safePerDay,
    saveLimit,
    topLines,
  } from "#lib/components/budgets/data.js";
  import LimitCell, {
    type Move,
  } from "#lib/components/budgets/LimitCell.svelte";
  import MeterBar from "#lib/components/budgets/MeterBar.svelte";
  import PeriodNav from "#lib/components/budgets/PeriodNav.svelte";
  import {
    periodPath,
    usePeriodPath,
  } from "#lib/components/budgets/period-path.svelte.js";
  import TopLine from "#lib/components/budgets/TopLine.svelte";
  import Triage from "#lib/components/budgets/Triage.svelte";
  import ListMenu from "#lib/components/categories/ListMenu.svelte";
  import MoneyList from "#lib/components/categories/MoneyList.svelte";
  import { setParam } from "#lib/components/categories/url.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { formatRange } from "#lib/format.js";
  import { type Binding, useKeys } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const PERIOD_WORDS: Record<string, string> = {
    daily: "a day",
    half_year: "every half year",
    monthly: "a month",
    quarterly: "a quarter",
    weekly: "a week",
    yearly: "a year",
  };

  usePeriodPath(() => "/budgets");

  const query = createQuery(() => ({
    enabled: period.ready,
    queryFn: () => loadBudgetPage(period.range, session.currencies),
    queryKey: ["budgets-page", period.start, period.end],
  }));

  const primary = $derived(session.primary?.code ?? "EUR");
  const rows = $derived(
    query.data
      ? buildRows(query.data, period.range, session.currencies, primary)
      : []
  );
  const tops = $derived(
    query.data
      ? topLines(
          buildPools(query.data, rows, session.currencies, primary),
          query.data.total,
          query.data.noBudget,
          primary
        )
      : []
  );
  const inactive = $derived(
    query.data?.budgets.filter((b) => !b.attributes.active) ?? []
  );
  const noBudgetHref = $derived(
    periodPath("/budgets/list/no-budget", period.start, period.end)
  );
  const enabled = $derived(
    session.currencies.filter((c) => c.attributes.enabled)
  );

  const scope = $derived<Scope>(
    page.url.searchParams.get("scope") === "all" ? "all" : "period"
  );
  const triageKey = $derived(
    scope === "all"
      ? ["budget-triage", "all"]
      : ["budget-triage", period.start, period.end]
  );
  const triage = createQuery(() => ({
    enabled: period.ready,
    queryFn: () => withoutBudget(scope === "all" ? null : period.range),
    queryKey: triageKey,
  }));
  const places = $derived(triage.data ? placesOf(triage.data, isOpen) : []);
  const options = $derived(
    rows.map((row) => ({ id: row.budget.id, name: row.budget.attributes.name }))
  );
  const nowCurrent = $derived(period.isCurrent);
  const endsLabel = $derived(
    period.view === "1M" ? "Ends month at" : "Ends period at"
  );

  let triaging = $state(false);
  let suggested = $state<Map<string, number> | null>(null);
  let suggestNote = $state("");
  let saving = $state(false);

  let editKey = $state<string | null>(null);
  let adding = $state<{ budgetId: string; code: string } | null>(null);
  let newName = $state("");
  let createError = $state("");
  let creating = $state(false);
  let createInput = $state<HTMLInputElement>();

  function showHref(row: BudgetRow) {
    const limits = row.lines.filter((line) => line.limit);
    return limits.length === 1
      ? `/budgets/show/${row.budget.id}/${limits[0].limit?.id}`
      : `/budgets/show/${row.budget.id}`;
  }

  function startAdding(row: BudgetRow) {
    const used = new Set(row.lines.map((line) => line.cur.code));
    const free = enabled.find((c) => !used.has(c.attributes.code));
    if (free) {
      editKey = null;
      adding = { budgetId: row.budget.id, code: free.attributes.code };
    }
  }

  function addingLine(row: BudgetRow): Line | null {
    if (adding?.budgetId !== row.budget.id) {
      return null;
    }
    const cur = enabled.find((c) => c.attributes.code === adding?.code);
    return {
      amount: null,
      cur: {
        code: adding.code,
        decimals: cur?.attributes.decimal_places ?? 2,
        id: cur?.id ?? "",
        symbol: cur?.attributes.symbol ?? adding.code,
      },
      key: `${row.budget.id}:new`,
      range: period.range,
      spent: 0,
    };
  }

  const suggestionFor = (row: BudgetRow, line: Line) =>
    line.amount === null
      ? (suggested?.get(`${row.budget.id}:${line.cur.code}`) ?? null)
      : null;

  function linesOf(row: BudgetRow): Line[] {
    const extra = addingLine(row);
    const lines = extra ? [...row.lines, extra] : row.lines;
    const prefix = `${row.budget.id}:`;
    const more = [...(suggested?.keys() ?? [])]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .filter((code) => !lines.some((line) => line.cur.code === code))
      .map((code) => ({
        amount: null,
        cur: curOf(session.currencies, code),
        key: `${prefix}${code}`,
        range: period.range,
        spent: 0,
      }));
    return [...lines, ...more];
  }

  function shownLines(row: BudgetRow): Line[] {
    const lines = linesOf(row);
    const open =
      adding?.budgetId === row.budget.id ||
      lines.some(
        (line) => line.key === editKey || suggestionFor(row, line) !== null
      );
    return open ? lines : mergeLines(lines, period.range);
  }

  const pending = $derived(
    rows.flatMap((row) =>
      linesOf(row).flatMap((line) => {
        const amount = suggestionFor(row, line);
        return amount ? [{ amount, line, row }] : [];
      })
    )
  );

  async function suggest() {
    suggestNote = "Looking at the last 3 months";
    try {
      suggested = await averages(period.range, period.view);
      suggestNote =
        pending.length > 0
          ? ""
          : "Every budget with spending already has an amount";
    } catch (failure) {
      suggestNote = failure instanceof Error ? failure.message : "Failed";
    }
  }

  function discard() {
    suggested = null;
    suggestNote = "";
  }

  async function saveSuggested() {
    if (saving || pending.length === 0) {
      return;
    }
    const items = pending;
    saving = true;
    let saved = 0;
    try {
      await items.reduce(
        (chain, item) =>
          chain.then(async () => {
            await saveLimit(
              item.row.budget.id,
              item.line,
              item.amount,
              period.range
            );
            saved += 1;
            suggestNote = `Saving ${saved} of ${items.length}`;
          }),
        Promise.resolve()
      );
      await invalidate();
      suggested = null;
      suggestNote = `Saved ${saved} ${saved === 1 ? "amount" : "amounts"}`;
    } catch (failure) {
      suggestNote = failure instanceof Error ? failure.message : "Failed";
    } finally {
      saving = false;
    }
  }

  async function createBudget(name: string) {
    const made = await api<One<Budget>>("/v1/budgets", {
      body: { name },
      method: "POST",
    });
    return { id: made.data.id, name: made.data.attributes.name };
  }

  function done(index: number, move: Move) {
    adding = null;
    const next = rows[index + move];
    if (move === 0 || !next) {
      editKey = null;
      return;
    }
    nav.move(index + move);
    editKey = next.lines[0].key;
  }

  async function remove(row: BudgetRow) {
    await api(`/v1/budgets/${row.budget.id}`, { method: "DELETE" });
    await invalidate();
  }

  async function create(event: SubmitEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (creating) {
      return;
    }
    if (!name) {
      createError = "Type a name first";
      createInput?.focus();
      return;
    }
    creating = true;
    createError = "";
    try {
      await api("/v1/budgets", { body: { name }, method: "POST" });
      newName = "";
      await invalidate();
    } catch (failure) {
      createError = failure instanceof Error ? failure.message : "Failed";
    } finally {
      creating = false;
    }
  }

  const nav: ListNav<BudgetRow> = new ListNav<BudgetRow>({
    edit: (row) => {
      adding = null;
      editKey = row.lines[0].key;
    },
    extra: (): Binding[] => [
      {
        group: "Budgets",
        keys: "E",
        label: "Edit budget",
        run: () =>
          nav.current && goto(`/budgets/edit/${nav.current.budget.id}`),
      },
      {
        group: "Budgets",
        keys: "a",
        label: "Budget an amount in another currency",
        run: () => nav.current && startAdding(nav.current),
      },
      {
        group: "Budgets",
        keys: "c",
        label: "New budget",
        run: () => createInput?.focus(),
      },
      {
        group: "Budgets",
        keys: "w",
        label: "Expenses without a budget",
        run: () => goto(noBudgetHref),
      },
    ],
    id: "budgets",
    items: () => rows,
    key: (row) => row.budget.id,
    open: (row) => goto(showHref(row)),
  });

  useKeys(() => [
    ...(triaging ? [] : nav.bindings()),
    {
      group: "Budgets",
      keys: "t",
      label: triaging ? "Stop sorting" : "Sort expenses without a budget",
      run: () => (triaging = !triaging),
    },
    {
      group: "Budgets",
      keys: "A",
      label: "Suggest empty amounts from the last 3 months",
      run: suggest,
    },
    ...(pending.length > 0 && !triaging
      ? [
          {
            group: "Budgets",
            keys: "mod+Enter",
            label: "Save the suggested amounts",
            run: saveSuggested,
          },
          {
            group: "Budgets",
            keys: "Escape",
            label: "Discard the suggested amounts",
            run: discard,
          },
        ]
      : []),
  ]);
</script>

<PageHeader crumbs={[{ label: "Budgets" }]} title="Budgets">
  {#snippet actions()}
    <Button href="/budgets/create" size="sm" variant="outline">
      <Plus />New budget
    </Button>
  {/snippet}
</PageHeader>

<PeriodNav base="/budgets" />

{#if query.isError}
  <p class="text-expense">Could not load budgets: {query.error.message}</p>
{/if}

<TopLine onsort={() => (triaging = true)} {tops} />

<Box body="p-0" class="mt-4" title="Budgets">
  {#snippet tools()}
    {#if pending.length > 0}
      <span class="text-[12px] text-cladd-fg-soft max-sm:hidden"
        >{pending.length}
        suggested from the last 3 months</span
      >
      <Button disabled={saving} onclick={saveSuggested} size="sm">
        Save {pending.length === 1 ? "it" : `all ${pending.length}`}
      </Button>
      <Button onclick={discard} size="sm" variant="ghost">Discard</Button>
    {:else if suggestNote}
      <span aria-live="polite" class="text-[12px] text-cladd-fg-soft"
        >{suggestNote}</span
      >
    {:else}
      <span class="text-[12px] text-cladd-fg-soft max-sm:hidden"
        ><span class="kbd">e</span>
        set amount
        <span class="kbd">A</span>
        suggest from the last 3 months</span
      >
    {/if}
  {/snippet}
  <div class="overflow-x-auto">
    <table class="w-full text-[13px] sm:min-w-[46rem]">
      <thead>
        <tr
          class="h-8 border-cladd-outline border-b text-left text-[12px] text-cladd-fg-soft"
        >
          <th class="px-3 font-medium">Budget</th>
          <th class="px-3 text-right font-medium">Budgeted</th>
          <th class="px-3 text-right font-medium">Spent</th>
          <th class="px-3 text-right font-medium max-sm:hidden">Left</th>
          {#if nowCurrent}
            <th class="px-3 text-right font-medium max-sm:hidden">Safe/day</th>
            <th
              class="whitespace-nowrap px-3 text-right font-medium max-md:hidden"
            >
              {endsLabel}
            </th>
          {/if}
          <th class="w-[24%] px-3 font-medium max-sm:hidden">Progress</th>
        </tr>
      </thead>
      <ListMenu
        deleteLabel="Delete budget"
        items={() => [
          {
            keys: "Enter",
            label: "Show",
            run: () => nav.current && goto(showHref(nav.current)),
          },
          {
            keys: "E",
            label: "Edit budget",
            run: () =>
              nav.current && goto(`/budgets/edit/${nav.current.budget.id}`),
          },
          {
            keys: "e",
            label: "Set budgeted amount",
            run: () => nav.current && (editKey = nav.current.lines[0].key),
          },
          {
            keys: "a",
            label: "Budget in another currency",
            run: () => nav.current && startAdding(nav.current),
          },
          {
            label: "Open in old UI",
            run: () =>
              nav.current &&
              location.assign(
                oldUiUrl(
                  `${location.origin}/budgets/show/${nav.current.budget.id}`
                )
              ),
          },
        ]}
        ondelete={() => nav.current && remove(nav.current)}
      >
        {#snippet children(
          props
        )}
          <tbody {...props}>
            {#each rows as row, i (row.budget.id)}
              {@const extra = addingLine(row)}
              {@const lines = shownLines(row)}
              {#each lines as line, j (line.key)}
                {@const p = pace(line)}
                {@const safe = safePerDay(line)}
                {@const ends = projection(line)}
                <tr
                  class="h-8 border-cladd-outline {j === lines.length - 1
                    ? "border-b"
                    : ""} {nav.cursor === i && !triaging
                    ? "bg-row-cursor"
                    : "hover:bg-row-hover"}"
                  id={j === 0 ? nav.rowId(i) : undefined}
                  onclick={(event) => {
                    triaging = false;
                    nav.click(i, event);
                  }}
                  oncontextmenu={() => (nav.cursor = i)}
                >
                  {#if j === 0}
                    <td class="px-3 align-top" rowspan={lines.length}>
                      <div
                        class="flex min-h-8 items-center gap-2 sm:whitespace-nowrap"
                      >
                        <a
                          class="text-cladd-fg hover:underline"
                          href={showHref(row)}
                          >{row.budget.attributes.name}</a
                        >
                        {#if row.budget.attributes.auto_budget_type &&
                          row.budget.attributes.auto_budget_amount}
                          <span
                            class="text-[12px] text-cladd-fg-soft max-sm:hidden"
                          >
                            auto
                            <span class="num"
                              >{display.text([
                                {
                                  amount:
                                    row.budget.attributes.auto_budget_amount,
                                  code: row.budget.attributes.currency_code,
                                  decimals:
                                    row.budget.attributes
                                      .currency_decimal_places,
                                  symbol: row.budget.attributes.currency_symbol,
                                },
                              ])}</span
                            >
                            {PERIOD_WORDS[
                              row.budget.attributes.auto_budget_period ?? ""
                            ] ?? ""}
                          </span>
                        {/if}
                        {#if !extra && row.lines.length < enabled.length}
                          <button
                            class="ml-auto inline-flex items-center gap-0.5 text-[11px] text-cladd-fg-softer hover:text-brand max-sm:hidden"
                            onclick={() => startAdding(row)}
                            title="Budget an amount in another currency (a)"
                            type="button"
                          >
                            <Plus class="size-3" />currency
                          </button>
                        {/if}
                      </div>
                    </td>
                  {/if}
                  <td class="px-3 text-right">
                    <div
                      class="flex items-center justify-end gap-1.5"
                      data-limit-editor={line === extra ? "" : undefined}
                    >
                      {#if line === extra}
                        <select
                          aria-label="Currency"
                          class="cladd-cut h-6 rounded-cladd-sm px-1 text-[12px]"
                          onchange={(event) =>
                            adding &&
                            (adding = {
                              ...adding,
                              code: event.currentTarget.value,
                            })}
                          value={adding?.code}
                        >
                          {#each enabled.filter(
                            (c) =>
                              c.attributes.code === adding?.code ||
                              !row.lines.some(
                                (l) => l.cur.code === c.attributes.code
                              )
                          ) as cur (cur.id)}
                            <option value={cur.attributes.code}>
                              {cur.attributes.code}
                            </option>
                          {/each}
                        </select>
                      {/if}
                      {#if line.limit &&
                        (line.range.start !== period.start ||
                          line.range.end !== period.end)}
                        <span class="text-[11px] text-cladd-fg-softer"
                          >{formatRange(line.range.start, line.range.end)}</span
                        >
                      {/if}
                      <LimitCell
                        budgetId={row.budget.id}
                        editing={line === extra || editKey === line.key}
                        {line}
                        ondone={(move) => done(i, move)}
                        onedit={() => {
                          nav.cursor = i;
                          adding = null;
                          editKey = line.key;
                        }}
                        range={period.range}
                        suggested={suggestionFor(row, line)}
                        trap={line !== extra}
                      />
                    </div>
                  </td>
                  <td class="px-3 text-right">
                    {#if line !== extra}
                      <Amount
                        amount={line.spent}
                        approx={line.approx}
                        code={line.cur.code}
                        decimals={line.cur.decimals}
                        symbol={line.cur.symbol}
                      />
                    {/if}
                  </td>
                  <td class="whitespace-nowrap px-3 text-right max-sm:hidden">
                    {#if line.amount !== null}
                      <span
                        class="num {line.amount + line.spent < 0
                          ? "text-expense"
                          : "text-cladd-fg"}"
                        >{lineMoney(line, line.amount + line.spent)}</span
                      >
                    {/if}
                  </td>
                  {#if nowCurrent}
                    <td class="num px-3 text-right max-sm:hidden">
                      {#if safe !== null}
                        <span
                          class={safe > 0 ? "text-cladd-fg" : "text-expense"}
                          >{lineMoney(line, safe)}</span
                        >
                      {/if}
                    </td>
                    <td class="num px-3 text-right max-md:hidden">
                      {#if ends && line.spent !== 0}
                        <span
                          class={line.amount && ends > line.amount
                            ? "text-expense"
                            : "text-cladd-fg-soft"}
                          >~{lineMoney(line, ends).replace("≈", "")}</span
                        >
                      {/if}
                    </td>
                  {/if}
                  <td class="px-3 max-sm:hidden">
                    <div class="flex items-center gap-2.5">
                      {#if line.amount}
                        <MeterBar
                          class="w-28 shrink-0"
                          max={line.amount}
                          tick={p?.fraction ?? null}
                          value={-line.spent}
                        />
                        {#if -line.spent > line.amount}
                          <span class="text-[12px] text-expense"
                            >Overspent</span
                          >
                        {:else if p && p.over > 0}
                          <span class="num text-[12px] text-warn"
                            >{lineMoney(line, p.over)}
                            over pace</span
                          >
                        {:else if p}
                          <span class="text-[12px] text-cladd-fg-soft"
                            >On track</span
                          >
                        {/if}
                      {:else if line.spent !== 0}
                        <span class="text-[12px] text-cladd-fg-soft"
                          >No amount set</span
                        >
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            {/each}
            <tr
              class="border-cladd-outline border-t bg-cladd-surface-next/40 max-sm:hidden"
            >
              <td class="whitespace-nowrap px-3 py-1.5">
                {@render noBudgetLabel()}
              </td>
              <td></td>
              <td class="px-3 py-1.5 text-right">
                <MoneyList sums={query.data?.noBudget ?? []} />
              </td>
              <td colspan={nowCurrent ? 4 : 2}></td>
            </tr>
            <tr
              class="border-cladd-outline border-t bg-cladd-surface-next/40 sm:hidden"
            >
              <td class="px-3 py-1.5" colspan="3">
                <div class="flex items-start justify-between gap-3">
                  <div>{@render noBudgetLabel()}</div>
                  <MoneyList
                    class="flex-col items-end"
                    sums={query.data?.noBudget ?? []}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        {/snippet}
      </ListMenu>
    </table>
  </div>
  {#snippet footer()}
    <form class="flex flex-1 items-center gap-2" onsubmit={create}>
      <input
        aria-label="New budget name"
        class="cladd-cut cladd-focusable-input h-7 w-64 min-w-0 flex-1 rounded-cladd-sm px-2 text-[13px] sm:flex-none"
        oninput={() => (createError = "")}
        placeholder="New budget name (c)"
        bind:this={createInput}
        bind:value={newName}
      >
      <Button disabled={creating} size="sm" type="submit">Create</Button>
      {#if createError}
        <span class="text-expense">{createError}</span>
      {/if}
    </form>
  {/snippet}
</Box>

<Triage
  active={triaging}
  assignPatch={(id) => ({ budget_id: id })}
  clearPatch={{ budget_id: 0 }}
  create={createBudget}
  empty={scope === "all"
    ? "Every expense has a budget."
    : `Every expense in ${period.label} has a budget.`}
  everything={scope === "all"}
  hint={(place) => learnedBudgets.get(place.accountId)?.name ?? null}
  ignoreKey="ffui.budget-ignored"
  loading={triage.isPending}
  noun="budget"
  onactivate={() => (triaging = true)}
  onassign={(place, option) => learnedBudgets.remember(place.accountId, option)}
  onchange={() => refreshExcept(triageKey)}
  onleave={() => (triaging = false)}
  onswitch={() => setParam("scope", scope === "all" ? "" : "all")}
  {options}
  periodLabel={period.label}
  pickKey="b"
  {places}
  problem={triage.isError ? `Could not load: ${triage.error.message}` : ""}
  title="Expenses without a budget"
/>

{#snippet noBudgetLabel()}
  <a class="text-brand italic hover:underline" href={noBudgetHref}
    >Expenses without a budget</a
  >
  {#if query.data?.noBudgetCount}
    <span class="ml-1.5 whitespace-nowrap text-[12px] text-cladd-fg-soft"
      >{query.data.noBudgetCount}
      transactions</span
    >
  {/if}
{/snippet}

{#if inactive.length > 0}
  <Box class="mt-4" title="Inactive budgets">
    <p class="text-[13px]">
      {#each inactive as budget, i (budget.id)}
        <a class="text-brand hover:underline" href="/budgets/show/{budget.id}"
          >{budget.attributes.name}</a
        >{i < inactive.length - 1 ? ", " : ""}
      {/each}
    </p>
  </Box>
{/if}
