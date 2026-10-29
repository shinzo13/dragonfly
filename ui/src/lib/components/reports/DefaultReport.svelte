<script lang="ts">
  import { bucketOf, buckets, group, keys, total } from "#lib/reports/flows.js";
  import { modeLabel, useReport } from "#lib/reports/report.svelte.js";
  import { bucketLabel } from "#lib/reports/view.js";
  import AccountBalances from "./AccountBalances.svelte";
  import BalanceLines from "./BalanceLines.svelte";
  import BudgetLimits from "./BudgetLimits.svelte";
  import DeltaToggle from "./DeltaToggle.svelte";
  import IncomeVsExpenses from "./IncomeVsExpenses.svelte";
  import Matrix from "./Matrix.svelte";
  import MoneyFlow from "./MoneyFlow.svelte";
  import PeriodChart from "./PeriodChart.svelte";
  import ReportBox from "./ReportBox.svelte";
  import ReportRow from "./ReportRow.svelte";
  import SpendingCalendar from "./SpendingCalendar.svelte";
  import Subscriptions from "./Subscriptions.svelte";
  import SumTable from "./SumTable.svelte";

  const report = useReport();
  const flows = $derived(report.flows);
  const month = $derived(report.template === "month");
  const income = $derived(flows?.filter((f) => f.dir === 1) ?? []);
  const expenses = $derived(flows?.filter((f) => f.dir === -1) ?? []);
  const withdrawals = $derived(expenses.filter((f) => f.type === "withdrawal"));
  const deposits = $derived(income.filter((f) => f.type === "deposit"));
  const bucket = (date: string) => bucketOf(date, report.grain);
  const periodCols = $derived(
    buckets(report.params.start, report.params.end, report.grain).map(
      (key) => ({
        key,
        label: bucketLabel(key, report.grain, true),
        title: bucketLabel(key, report.grain),
      })
    )
  );
  const accountCols = $derived(
    report.selected
      .filter((id) => withdrawals.some((f) => f.asset.id === id))
      .map((id) => ({
        key: id,
        label: report.byId().get(id)?.name ?? `#${id}`,
      }))
  );
</script>

<div class="flex flex-col gap-4">
  {#if month}
    <BalanceLines />
  {:else}
    <PeriodChart {flows} />
  {/if}

  <ReportRow class="lg:grid-cols-2">
    <AccountBalances />
    <IncomeVsExpenses />
  </ReportRow>

  <MoneyFlow />

  <ReportRow class="lg:grid-cols-2">
    <ReportBox
      empty={income.length === 0}
      id="income"
      loading={!flows}
      title="Revenue / income"
    >
      <SumTable
        box="income"
        columns={[
          { kind: "in", label: "Total" },
          { kind: "avg-in", label: "Average" },
        ]}
        counts
        dim="other"
        dir={1}
        footer={total(income)}
        limit={10}
        rows={group(income, keys.other)}
        sort="in"
      />
    </ReportBox>
    <ReportBox
      empty={expenses.length === 0}
      id="expenses"
      loading={!flows}
      title="Expenses"
    >
      <SumTable
        box="expenses"
        columns={[
          { kind: "out", label: "Total" },
          { kind: "avg-out", label: "Average" },
        ]}
        counts
        dim="other"
        dir={-1}
        footer={total(expenses)}
        limit={10}
        rows={group(expenses, keys.other)}
        sort="out"
      />
    </ReportBox>
  </ReportRow>

  {#if month}
    <ReportRow class="lg:grid-cols-12">
      <BudgetLimits class="lg:col-span-7" />
      <ReportBox
        class="lg:col-span-5"
        empty={(flows?.length ?? 0) === 0}
        id="categories"
        loading={!flows}
        title="Categories"
      >
        <SumTable
          box="categories"
          columns={[
            { kind: "out", label: "Spent" },
            { kind: "in", label: "Earned" },
            { kind: "net", label: "Sum" },
          ]}
          dim="category"
          footer={report.totals}
          limit={10}
          nameLabel="Category"
          rows={group(flows ?? [], keys.category)}
        />
      </ReportBox>
    </ReportRow>

    <ReportBox
      empty={accountCols.length === 0}
      id="budget-accounts"
      loading={!flows}
      title="Budgets (split by account)"
    >
      <Matrix
        box="budget-accounts"
        colIs="asset"
        cols={accountCols}
        dim="budget"
        dir={-1}
        multi
        nameLabel="Budget"
        rows={group(withdrawals, keys.budget, (f) => f.asset.id)}
        side="out"
      />
    </ReportBox>

    <ReportRow class="lg:grid-cols-2">
      <ReportBox
        empty={(flows?.length ?? 0) === 0}
        id="tags"
        loading={!flows}
        title="Tags"
      >
        <SumTable
          box="tags"
          columns={[
            { kind: "out", label: "Spent" },
            { kind: "in", label: "Earned" },
          ]}
          dim="tag"
          footer={report.totals}
          limit={10}
          nameLabel="Tag"
          rows={group(flows ?? [], keys.tag)}
        />
      </ReportBox>
      <SpendingCalendar />
    </ReportRow>

    <Subscriptions />
  {:else}
    <BalanceLines net />

    <ReportBox
      empty={withdrawals.length === 0}
      id="budget-periods"
      loading={!flows}
      title="Budgets ({modeLabel(report.mode)})"
    >
      {#snippet tools()}
        <DeltaToggle box="budget-periods" />
      {/snippet}
      <Matrix
        average
        box="budget-periods"
        cols={periodCols}
        delta={report.delta === "budget-periods"}
        dim="budget"
        dir={-1}
        nameLabel="Budget"
        rows={group(withdrawals, keys.budget, (f) => bucket(f.date))}
        side="out"
      />
    </ReportBox>

    <ReportBox
      empty={expenses.length === 0}
      id="category-expenses"
      loading={!flows}
      title="Categories (Expenses) ({modeLabel(report.mode)})"
    >
      {#snippet tools()}
        <DeltaToggle box="category-expenses" />
      {/snippet}
      <Matrix
        box="category-expenses"
        cols={periodCols}
        delta={report.delta === "category-expenses"}
        dim="category"
        dir={-1}
        nameLabel="Category"
        rows={group(withdrawals, keys.category, (f) => bucket(f.date))}
        side="out"
      />
    </ReportBox>

    <ReportBox
      empty={deposits.length === 0}
      id="category-income"
      loading={!flows}
      title="Categories (Revenue / income) ({modeLabel(report.mode)})"
    >
      {#snippet tools()}
        <DeltaToggle box="category-income" />
      {/snippet}
      <Matrix
        box="category-income"
        cols={periodCols}
        delta={report.delta === "category-income"}
        dim="category"
        dir={1}
        nameLabel="Category"
        rows={group(deposits, keys.category, (f) => bucket(f.date))}
        side="in"
      />
    </ReportBox>

    <ReportBox
      empty={(flows?.length ?? 0) === 0}
      id="tag-periods"
      loading={!flows}
      title="Tags (Expenses) ({modeLabel(report.mode)})"
    >
      {#snippet tools()}
        <DeltaToggle box="tag-periods" />
      {/snippet}
      <Matrix
        box="tag-periods"
        cols={periodCols}
        delta={report.delta === "tag-periods"}
        dim="tag"
        dir={-1}
        nameLabel="Tag"
        rows={group(expenses, keys.tag, (f) => bucket(f.date))}
        side="out"
      />
    </ReportBox>

    <SpendingCalendar />
  {/if}
</div>
