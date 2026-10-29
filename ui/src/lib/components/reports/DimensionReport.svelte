<script lang="ts">
  import {
    bucketOf,
    buckets,
    type Dimension,
    type Flow,
    group,
    type Key,
    keys,
    topFlows,
    total,
  } from "#lib/reports/flows.js";
  import {
    LIST_LENGTH,
    modeLabel,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import { bucketLabel } from "#lib/reports/view.js";
  import DeltaToggle from "./DeltaToggle.svelte";
  import FlowTable from "./FlowTable.svelte";
  import Matrix from "./Matrix.svelte";
  import PeriodChart from "./PeriodChart.svelte";
  import ReportBox from "./ReportBox.svelte";
  import ReportRow from "./ReportRow.svelte";
  import ShareBars from "./ShareBars.svelte";
  import SumTable from "./SumTable.svelte";

  const report = useReport();
  const type = $derived(report.params.type);
  const flows = $derived(report.scoped);
  const loading = $derived(!flows);
  const out = $derived(flows?.filter((f) => f.dir === -1) ?? []);
  const inn = $derived(flows?.filter((f) => f.dir === 1) ?? []);
  const hasIncome = $derived(type !== "budget" && inn.length > 0);

  const tagNames = $derived(
    new Set(
      report.items
        .map((id) => report.itemName("tag", id))
        .filter((name): name is string => !!name)
    )
  );

  const itemDim = $derived<Dimension>(
    (
      {
        budget: "budget",
        category: "category",
        double: "name",
        tag: "tag",
      } as const
    )[type as "budget" | "category" | "double" | "tag"]
  );
  const itemKey = $derived.by(() => {
    if (type === "tag") {
      return (flow: Flow) => keys.tag(flow).filter((k) => tagNames.has(k.key));
    }
    return keys[itemDim] as (flow: Flow) => Key | Key[] | null;
  });
  const NAMES = {
    budget: { many: "Budgets", one: "Budget" },
    category: { many: "Categories", one: "Category" },
    double: { many: "Expense/revenue accounts", one: "Account" },
    tag: { many: "Tags", one: "Tag" },
  } as const;
  const names = $derived(NAMES[type as keyof typeof NAMES]);

  const items = $derived.by(() => {
    if (type === "double") {
      const seen = new Map<string, string>();
      for (const flow of flows ?? []) {
        const key = keys.name(flow);
        seen.set(key.key, key.label);
      }
      return [...seen.entries()].map(([key, label]) => ({ key, label }));
    }
    return report.items.map((id) => {
      const kind = type === "tag" ? "tag" : type;
      const label = report.itemName(kind, id) ?? `#${id}`;
      return { key: type === "tag" ? label : id, label };
    });
  });

  const itemRows = $derived(group(flows ?? [], itemKey));
  const accountRows = $derived(group(flows ?? [], keys.asset));
  const accountMatrix = $derived(
    group(flows ?? [], keys.asset, (f) => {
      const found = itemKey(f);
      const first = Array.isArray(found) ? found[0] : found;
      return first?.key ?? null;
    })
  );
  const periodCols = $derived(
    buckets(report.params.start, report.params.end, report.grain).map(
      (key) => ({
        key,
        label: bucketLabel(key, report.grain, true),
        title: bucketLabel(key, report.grain),
      })
    )
  );
  const top = $derived((dir: 1 | -1) =>
    topFlows(flows ?? [], report.mode, dir, LIST_LENGTH)
  );
  const sumColumns = $derived(
    hasIncome
      ? [
          { kind: "out" as const, label: "Spent" },
          { kind: "in" as const, label: "Earned" },
          { kind: "net" as const, label: "Sum" },
        ]
      : [{ kind: "out" as const, label: "Spent" }]
  );
  const itemColumns = $derived(
    hasIncome
      ? sumColumns
      : [
          { kind: "out" as const, label: "Spent" },
          { kind: "pct-out" as const, label: "pct." },
        ]
  );
  const flowColumns = $derived(
    type === "double"
      ? ["date", "description", "account", "other"]
      : [
          "date",
          "description",
          "account",
          "other",
          type === "budget" ? "budget" : "category",
        ]
  );
  const mode = $derived(modeLabel(report.mode));
</script>

<div class="flex flex-col gap-4">
  <ReportRow class="lg:grid-cols-2">
    <ReportBox
      empty={accountRows.length === 0}
      id="accounts"
      {loading}
      title={type === "double"
        ? "Earned and spent (per asset account)"
        : "Accounts"}
    >
      <SumTable
        box="accounts"
        columns={sumColumns}
        dim="asset"
        footer={report.totals}
        rows={accountRows}
      />
    </ReportBox>
    <ReportBox
      empty={itemRows.length === 0}
      id="items"
      {loading}
      title={type === "double"
        ? "Earned and spent per combination"
        : names.many}
    >
      <SumTable
        box="items"
        columns={itemColumns}
        dim={itemDim}
        footer={report.totals}
        nameLabel={names.one}
        rows={itemRows}
      />
    </ReportBox>
  </ReportRow>

  {#if type !== "double"}
    <ReportBox
      empty={accountMatrix.length === 0}
      id="account-matrix"
      {loading}
      title="Account per {names.one.toLowerCase()}"
    >
      <Matrix
        box="account-matrix"
        colIs="item"
        cols={items}
        dim="asset"
        {itemDim}
        multi
        nameLabel="Account"
        rows={accountMatrix}
        side={hasIncome ? "net" : "out"}
      />
    </ReportBox>
  {/if}

  <ReportBox
    empty={itemRows.length === 0}
    id="item-periods"
    {loading}
    title="{names.many} per period ({mode})"
  >
    {#snippet tools()}
      <DeltaToggle box="item-periods" />
    {/snippet}
    <Matrix
      average
      box="item-periods"
      cols={periodCols}
      delta={report.delta === "item-periods"}
      dim={itemDim}
      dir={-1}
      nameLabel={names.one}
      rows={group(out, itemKey, (f) => bucketOf(f.date, report.grain))}
      side="out"
    />
  </ReportBox>

  <ReportRow class={type === "budget" ? "lg:grid-cols-2" : "lg:grid-cols-3"}>
    {#if type === "tag"}
      <ReportBox
        empty={out.length === 0}
        id="share-item-out"
        {loading}
        title="Expense per tag ({mode})"
      >
        <ShareBars
          box="share-item-out"
          dim="tag"
          rows={group(out, itemKey)}
          side="out"
        />
      </ReportBox>
      <ReportBox
        empty={inn.length === 0}
        id="share-item-in"
        {loading}
        title="Income per tag ({mode})"
      >
        <ShareBars
          box="share-item-in"
          dim="tag"
          rows={group(inn, itemKey)}
          side="in"
        />
      </ReportBox>
      <div class="max-lg:hidden"></div>
    {/if}
    {#if type === "budget"}
      <ReportBox
        empty={out.length === 0}
        id="share-budget"
        {loading}
        title="Expense per budget ({mode})"
      >
        <ShareBars
          box="share-budget"
          dim="budget"
          rows={group(out, keys.budget)}
          side="out"
        />
      </ReportBox>
    {/if}
    <ReportBox
      empty={out.length === 0}
      id="share-category-out"
      {loading}
      title="Expense per category ({mode})"
    >
      <ShareBars
        box="share-category-out"
        dim="category"
        rows={group(out, keys.category)}
        side="out"
      />
    </ReportBox>
    {#if hasIncome}
      <ReportBox
        empty={inn.length === 0}
        id="share-category-in"
        {loading}
        title="Income per category ({mode})"
      >
        <ShareBars
          box="share-category-in"
          dim="category"
          rows={group(inn, keys.category)}
          side="in"
        />
      </ReportBox>
      <ReportBox
        empty={out.length === 0}
        id="share-budget"
        {loading}
        title="Expense per budget ({mode})"
      >
        <ShareBars
          box="share-budget"
          dim="budget"
          rows={group(out, keys.budget)}
          side="out"
        />
      </ReportBox>
    {/if}
  </ReportRow>

  {#if type === "double"}
    <ReportRow class="lg:grid-cols-2">
      <ReportBox
        empty={out.length === 0}
        id="share-tag-out"
        {loading}
        title="Expense per tag ({mode})"
      >
        <ShareBars
          box="share-tag-out"
          dim="tag"
          rows={group(out, keys.tag)}
          side="out"
        />
      </ReportBox>
      <ReportBox
        empty={inn.length === 0}
        id="share-tag-in"
        {loading}
        title="Income per tag ({mode})"
      >
        <ShareBars
          box="share-tag-in"
          dim="tag"
          rows={group(inn, keys.tag)}
          side="in"
        />
      </ReportBox>
    </ReportRow>
  {:else}
    <ReportRow class="lg:grid-cols-2">
      <ReportBox
        empty={out.length === 0}
        id="share-source"
        {loading}
        title="Expenses per source account ({mode})"
      >
        <ShareBars
          box="share-source"
          dim="asset"
          rows={group(out, keys.asset)}
          side="out"
        />
      </ReportBox>
      {#if hasIncome}
        <ReportBox
          empty={inn.length === 0}
          id="share-income-source"
          {loading}
          title="Income per source account ({mode})"
        >
          <ShareBars
            box="share-income-source"
            dim="other"
            rows={group(inn, keys.other)}
            side="in"
          />
        </ReportBox>
      {/if}
      <ReportBox
        empty={out.length === 0}
        id="share-destination"
        {loading}
        title="Expenses per destination account ({mode})"
      >
        <ShareBars
          box="share-destination"
          dim="other"
          rows={group(out, keys.other)}
          side="out"
        />
      </ReportBox>
      {#if hasIncome}
        <ReportBox
          empty={inn.length === 0}
          id="share-income-destination"
          {loading}
          title="Income per destination account ({mode})"
        >
          <ShareBars
            box="share-income-destination"
            dim="asset"
            rows={group(inn, keys.asset)}
            side="in"
          />
        </ReportBox>
      {/if}
    </ReportRow>
  {/if}

  {#each items as item (item.key)}
    {@const subset = flows?.filter((f) => {
      const found = itemKey(f);
      return Array.isArray(found)
        ? found.some((k) => k.key === item.key)
        : found?.key === item.key;
    })}
    {#if !subset || subset.length > 0}
      <PeriodChart
        dim={itemDim}
        flows={subset}
        id="item-{item.key}"
        itemKey={item.key}
        title={type === "budget"
          ? `Expenses (${item.label}),`
          : `Income and expenses (${item.label}),`}
      />
    {/if}
  {/each}

  <ReportRow class="lg:grid-cols-2">
    <ReportBox
      empty={out.length === 0}
      id="avg-out"
      {loading}
      title={type === "double"
        ? "Average expense per source account"
        : "Average expense per destination account"}
    >
      <SumTable
        averageAll
        box="avg-out"
        columns={[
          { kind: "avg-out", label: "Spent (average)" },
          { kind: "out", label: "Total" },
          { kind: "count", label: "Transaction count" },
        ]}
        dim={type === "double" ? "asset" : "other"}
        dir={-1}
        limit={LIST_LENGTH}
        nameLabel="Account"
        rows={group(out, type === "double" ? keys.asset : keys.other)}
      />
    </ReportBox>
    {#if hasIncome}
      <ReportBox
        empty={inn.length === 0}
        id="avg-in"
        {loading}
        title={type === "double"
          ? "Average earning per destination account"
          : "Average earning per source account"}
      >
        <SumTable
          averageAll
          box="avg-in"
          columns={[
            { kind: "avg-in", label: "Income (average)" },
            { kind: "in", label: "Total" },
            { kind: "count", label: "Transaction count" },
          ]}
          dim={type === "double" ? "asset" : "other"}
          dir={1}
          limit={LIST_LENGTH}
          nameLabel="Account"
          rows={group(inn, type === "double" ? keys.asset : keys.other)}
          sort="in"
        />
      </ReportBox>
    {:else}
      <ReportBox
        empty={top(-1).length === 0}
        id="top-out"
        {loading}
        title="Expenses (top {LIST_LENGTH}, {mode})"
      >
        <FlowTable columns={flowColumns} flows={top(-1)} />
      </ReportBox>
    {/if}
  </ReportRow>

  {#if hasIncome}
    <ReportRow class="lg:grid-cols-2">
      <ReportBox
        empty={top(-1).length === 0}
        id="top-out"
        {loading}
        title="Expenses (top {LIST_LENGTH}, {mode})"
      >
        <FlowTable columns={flowColumns} flows={top(-1)} />
      </ReportBox>
      <ReportBox
        empty={top(1).length === 0}
        id="top-in"
        {loading}
        title="Revenue / income (top {LIST_LENGTH}, {mode})"
      >
        <FlowTable columns={flowColumns} flows={top(1)} />
      </ReportBox>
    </ReportRow>
  {/if}
</div>
