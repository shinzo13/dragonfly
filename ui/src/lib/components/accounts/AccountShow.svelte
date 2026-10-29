<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { DropdownMenu } from "bits-ui";
  import { viewOf } from "#lib/accounts/statement.js";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { Account, One, Page, TransactionGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import LineChart from "#lib/components/charts/LineChart.svelte";
  import {
    axis,
    balanceDate,
    type ChartSet,
    currency,
    hasPrimary,
    money,
    seriesPoints,
    setPrimary,
    span,
  } from "#lib/components/dashboard/data.js";
  import Merchant from "#lib/components/dimension/Merchant.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Pager from "#lib/components/transactions/Pager.svelte";
  import TransactionTable from "#lib/components/transactions/TransactionTable.svelte";
  import DropdownMenuContent from "#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte";
  import DropdownMenuItem from "#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte";
  import { contains, daysBetween, today } from "#lib/dates.js";
  import { formatRange } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Breakdown from "./Breakdown.svelte";
  import DebtPanel from "./DebtPanel.svelte";
  import {
    canReconcile,
    createUrl,
    editUrl,
    go,
    indexUrl,
    LIABILITY_LABEL,
    openOld,
    ROLE_LABEL,
    reconcileUrl,
    showUrl,
    TYPE_TITLE,
    typeOf,
  } from "./links.js";
  import PeriodList from "./PeriodList.svelte";
  import Statement from "./Statement.svelte";

  const SPECIAL = new Set(["initial-balance", "reconciliation"]);
  const BUTTON =
    "cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-[12px] text-cladd-fg";

  let { id, everything = false }: { id: string; everything?: boolean } =
    $props();

  let failure = $state("");

  const until = $derived(balanceDate(period.start, period.end));
  const account = createQuery(() => ({
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<One<Account>>(`/v1/accounts/${id}`, {
        query: everything ? { date: today() } : { date: until },
      }),
    queryKey: ["account", id, everything ? "all" : until],
  }));
  const a = $derived(account.data?.data.attributes);
  const type = $derived(a ? typeOf(a) : "asset");
  const item = $derived(account.data?.data);
  const debt = $derived(a?.liability_type === "debt");
  const statement = $derived(
    !everything && (type === "asset" || type === "liabilities")
  );
  const merchant = $derived(type === "expense" || type === "revenue");

  const first = createQuery(() => ({
    enabled: everything && !merchant,
    queryFn: async () => {
      const head = await api<Page<TransactionGroup>>(
        `/v1/accounts/${id}/transactions`,
        { query: { limit: 1 } }
      );
      const pages = head.meta.pagination?.total_pages ?? 1;
      const last =
        pages > 1
          ? await api<Page<TransactionGroup>>(
              `/v1/accounts/${id}/transactions`,
              {
                query: { limit: 1, page: pages },
              }
            )
          : head;
      return (
        last.data[0]?.attributes.transactions[0]?.date?.slice(0, 10) ?? today()
      );
    },
    queryKey: ["account-first", id],
  }));

  const range = $derived(
    everything
      ? { end: today(), start: first.data ?? today() }
      : { end: period.end, start: period.start }
  );
  const step = $derived.by(() => {
    const days = daysBetween(range.start, range.end);
    if (days <= 92) {
      return "1D";
    }
    if (days <= 730) {
      return "1W";
    }
    return days <= 3000 ? "1M" : "1Y";
  });
  const chart = createQuery(() => ({
    enabled: !(statement || merchant) && (!everything || first.isSuccess),
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<ChartSet[]>("/v1/chart/account/overview", {
        query: {
          "accounts[]": id,
          end: range.end > range.start ? range.end : range.start,
          period: step,
          start: range.start,
        },
      }),
    queryKey: ["account-chart", id, range.start, range.end, step],
  }));
  const converted = $derived(!display.active && hasPrimary(chart.data ?? []));
  const cur = $derived(
    currency(a?.currency_code ?? session.primary?.code ?? "")
  );
  const view = $derived(display.active ? viewOf(cur) : null);
  const series = $derived(
    (chart.data ?? []).map((set) => {
      const own = viewOf(currency(set.currency_code));
      return {
        area: true,
        format: view
          ? own.format
          : money(converted ? setPrimary(set) : currency(set.currency_code)),
        key: set.label,
        label: set.label,
        points: seriesPoints(set, converted).map((p) => ({
          ...p,
          y: p.y * own.rate,
        })),
      };
    })
  );

  const pageNo = $derived(
    Number(page.url.searchParams.get("page") ?? "1") || 1
  );
  const dated = createQuery(() => ({
    enabled: !(everything || statement || merchant),
    placeholderData: keepPreviousData,
    queryFn: () =>
      all<TransactionGroup>(
        `/v1/accounts/${id}/transactions`,
        span(period.start, period.end)
      ).then((list) =>
        list.filter((g) =>
          g.attributes.transactions.some((s) => contains(period.range, s.date))
        )
      ),
    queryKey: ["account-tx-all", id, period.start, period.end],
  }));
  const paged = createQuery(() => ({
    enabled: everything && !merchant,
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<Page<TransactionGroup>>(`/v1/accounts/${id}/transactions`, {
        query: { limit: session.pageSize, page: pageNo },
      }),
    queryKey: ["account-tx-page", id, pageNo, session.pageSize],
  }));
  const groups = $derived(
    everything ? (paged.data?.data ?? []) : (dated.data ?? [])
  );
  const pages = $derived(paged.data?.meta.pagination?.total_pages ?? 1);
  const total = $derived(
    everything ? (paged.data?.meta.pagination?.total ?? 0) : groups.length
  );

  $effect(() => {
    if (!(a && SPECIAL.has(String(a.type)))) {
      return;
    }
    api<Page<TransactionGroup>>(`/v1/accounts/${id}/transactions`, {
      query: { limit: 1 },
    }).then((res) => {
      const split = res.data[0]?.attributes.transactions[0];
      const other =
        split?.source_id === id ? split?.destination_id : split?.source_id;
      goto(other ? showUrl(other) : "/", { replace: true });
    });
  });

  const marker = $derived(contains(range, today()) ? today() : undefined);
  const subtitle = $derived.by(() => {
    if (!a) {
      return "";
    }
    if (type === "asset") {
      return ROLE_LABEL[a.account_role ?? ""] ?? "";
    }
    if (type === "liabilities") {
      return LIABILITY_LABEL[a.liability_type ?? ""] ?? "";
    }
    return TYPE_TITLE[type].replace(" accounts", " account");
  });
  const balance = $derived(
    a ? display.text([{ amount: a.current_balance, ...cur }]) : ""
  );

  function pageHref(n: number) {
    const url = new URL(page.url.href);
    url.searchParams.set("page", String(n));
    return url.pathname + url.search;
  }

  async function remove() {
    failure = "";
    try {
      await api(`/v1/accounts/${id}`, { method: "DELETE" });
      await invalidate();
      goto(indexUrl(type));
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
  }

  useKeys(() => [
    {
      group: "Account",
      keys: "E",
      label: "Edit this account",
      run: () => goto(editUrl(id)),
    },
    ...(type === "asset"
      ? [
          {
            group: "Account",
            keys: "R",
            label: "Reconcile this account",
            run: () => go(reconcileUrl(id)),
          },
        ]
      : []),
    {
      group: "Account",
      keys: "A",
      label: everything ? "Show the current period" : "Show all transactions",
      run: () => goto(everything ? showUrl(id) : `${showUrl(id)}/all`),
    },
  ]);
</script>

<PageHeader
  crumbs={[
    { href: indexUrl(type), label: TYPE_TITLE[type] },
    ...(everything
      ? [{ label: a?.name ?? "" }]
      : [
          { href: `${showUrl(id)}/all`, label: a?.name ?? "" },
          { label: formatRange(period.start, period.end) },
        ]),
  ]}
  {subtitle}
  title={a?.name ?? "Account"}
>
  {#snippet actions()}
    <div class="flex flex-wrap items-center gap-1.5">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class="{BUTTON} cladd-color-green text-cladd-primary"
        >
          Create <ChevronDown class="size-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuItem onSelect={() => go(createUrl("withdrawal", id))}
            >New withdrawal</DropdownMenuItem
          >
          <DropdownMenuItem onSelect={() => go(createUrl("deposit", id))}
            >New deposit</DropdownMenuItem
          >
          <DropdownMenuItem onSelect={() => go(createUrl("transfer", id))}
            >New transfer</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu.Root>
      <a class={BUTTON} href={editUrl(id)} title="Edit  Shift+E">Edit</a>
      {#if item && canReconcile(item)}
        <a class={BUTTON} href={reconcileUrl(id)} title="Reconcile  Shift+R"
          >Reconcile</a
        >
      {/if}
      <ConfirmButton onconfirm={remove}>Delete</ConfirmButton>
      <button
        class={BUTTON}
        onclick={() => openOld(page.url.pathname)}
        type="button"
      >
        Old UI
      </button>
    </div>
  {/snippet}
</PageHeader>

{#if failure}
  <p class="pb-3 text-expense">{failure}</p>
{/if}

{#if statement}
  {#if item}
    <Statement {item} />
  {/if}
{:else if merchant}
  <Merchant {everything} {id} />
{:else}
  <div class="flex flex-col gap-3">
    <div
      class="grid gap-3 {debt
        ? "xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
        : ""}"
    >
      {#if debt && item}
        <DebtPanel {item} />
      {/if}
      <Box
        title={a
          ? `Chart for ${a.name} (${balance}) between ${formatRange(range.start, range.end)}`
          : "Chart"}
      >
        <div
          class="transition-opacity {chart.isPlaceholderData
            ? "opacity-60"
            : ""}"
        >
          {#if chart.isPending || (everything && first.isPending)}
            <div class="h-[300px]"></div>
          {:else if chart.isError}
            <p class="text-expense">{chart.error.message}</p>
          {:else if series.length === 0}
            <p class="py-10 text-center text-cladd-fg-soft">
              No balance to draw.
            </p>
          {:else}
            <LineChart
              axisFormat={view?.axis ??
                axis(converted ? setPrimary(chart.data?.[0] as ChartSet) : cur)}
              height={300}
              label="Balance of {a?.name ?? "the account"}"
              {marker}
              {series}
              toggle={false}
            />
          {/if}
        </div>
      </Box>
    </div>

    {#if !everything}
      <div class="grid gap-3 md:grid-cols-3">
        <Breakdown
          by="category"
          {groups}
          kind="withdrawal"
          title="Expenses by category"
        />
        <Breakdown
          by="budget"
          {groups}
          kind="withdrawal"
          title="Expenses by budget"
        />
        <Breakdown
          by="category"
          {groups}
          kind="deposit"
          title="Income by category"
        />
      </div>
    {/if}

    {#if a?.notes}
      <Box title="Notes">
        <p class="whitespace-pre-wrap text-cladd-fg">{a.notes}</p>
      </Box>
    {/if}

    <div
      class="grid gap-3 {everything
        ? ""
        : "min-[1700px]:grid-cols-[minmax(0,1fr)_15rem]"}"
    >
      <Box body="p-0" title="Transactions">
        {#snippet tools()}
          <span class="num text-[12px] text-cladd-fg-soft"
            >{total}
            transactions</span
          >
          {#if everything}
            <Pager href={pageHref} keys page={pageNo} {pages} />
          {/if}
        {/snippet}
        <TransactionTable
          context={{ accountId: id }}
          empty={everything
            ? "No transactions."
            : "No transactions in this period."}
          {groups}
          id="account-tx"
          loading={everything ? paged.isFetching : dated.isFetching}
        />
        {#snippet footer()}
          {#if everything}
            <a
              class="text-brand dark:text-(--ff-series-1) hover:underline"
              href={showUrl(id)}
              >Show the current period and overview</a
            >
            <span class="ml-auto"
              ><Pager href={pageHref} page={pageNo} {pages} /></span
            >
          {:else}
            <a
              class="text-brand dark:text-(--ff-series-1) hover:underline"
              href="{showUrl(id)}/all"
              >Show all transactions without grouping them by date</a
            >
          {/if}
        {/snippet}
      </Box>
      {#if !everything && a}
        <div class="order-first min-w-0 min-[1700px]:order-none">
          <PeriodList accountId={id} code={a.currency_code ?? ""} />
        </div>
      {/if}
    </div>
  </div>
{/if}
