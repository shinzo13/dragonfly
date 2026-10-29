<script lang="ts">
  import { bucketOf, buckets, group, keys, total } from "#lib/reports/flows.js";
  import { modeLabel, useReport } from "#lib/reports/report.svelte.js";
  import { bucketLabel } from "#lib/reports/view.js";
  import BudgetLimits from "./BudgetLimits.svelte";
  import CurrencySwitch from "./CurrencySwitch.svelte";
  import Matrix from "./Matrix.svelte";
  import ReportBox from "./ReportBox.svelte";
  import ReportRow from "./ReportRow.svelte";
  import SpendingCalendar from "./SpendingCalendar.svelte";
  import Subscriptions from "./Subscriptions.svelte";
  import SumTable from "./SumTable.svelte";

  let { view }: { view: "year" | "month" } = $props();

  const report = useReport();
  const flows = $derived(report.flows);
  const income = $derived(flows?.filter((f) => f.dir === 1) ?? []);
  const expenses = $derived(flows?.filter((f) => f.dir === -1) ?? []);
  const withdrawals = $derived(expenses.filter((f) => f.type === "withdrawal"));
  const deposits = $derived(income.filter((f) => f.type === "deposit"));
  const periodCols = $derived(
    buckets(report.params.start, report.params.end, "month").map((key) => ({
      key,
      label: bucketLabel(key, "month", true),
      title: bucketLabel(key, "month"),
    }))
  );
  const month = (date: string) => bucketOf(date, "month");
  const NAMES = { budget: "Budget", category: "Category", tag: "Tag" };
</script>

{#snippet matrix(
  id: string,
  title: string,
  dim: "budget" | "category" | "tag",
  dir: 1 | -1,
  list: typeof expenses
)}
  <ReportBox
    empty={list.length === 0}
    {id}
    loading={!flows}
    title="{title} in {modeLabel(report.mode)}"
  >
    {#snippet tools()}
      <CurrencySwitch />
    {/snippet}
    <Matrix
      average={dim === "budget"}
      box={id}
      cols={periodCols}
      {dim}
      {dir}
      nameLabel={NAMES[dim]}
      rows={group(list, keys[dim], (f) => month(f.date))}
      side={dir === 1 ? "in" : "out"}
    />
  </ReportBox>
{/snippet}

<div class="flex flex-col gap-4">
  {#if view === "year"}
    {@render matrix("budget-periods", "Budgets", "budget", -1, withdrawals)}
    {@render matrix(
      "category-expenses",
      "Categories, spent",
      "category",
      -1,
      withdrawals
    )}
    {@render matrix(
      "category-income",
      "Categories, earned",
      "category",
      1,
      deposits
    )}
    {@render matrix("tag-periods", "Tags, spent", "tag", -1, expenses)}
  {:else}
    <ReportRow class="lg:grid-cols-2">
      <ReportBox
        empty={expenses.length === 0}
        id="expenses"
        loading={!flows}
        title="Expenses"
      >
        <SumTable
          box="expenses"
          columns={[{ kind: "out", label: "Total" }]}
          counts
          dim="other"
          dir={-1}
          footer={total(expenses)}
          limit={10}
          rows={group(expenses, keys.other)}
          sort="out"
        />
      </ReportBox>
      <ReportBox
        empty={income.length === 0}
        id="income"
        loading={!flows}
        title="Revenue / income"
      >
        <SumTable
          box="income"
          columns={[{ kind: "in", label: "Total" }]}
          counts
          dim="other"
          dir={1}
          footer={total(income)}
          limit={10}
          rows={group(income, keys.other)}
          sort="in"
        />
      </ReportBox>
    </ReportRow>
    <ReportRow class="lg:grid-cols-12">
      <BudgetLimits class="lg:col-span-7" />
      <ReportBox
        class="lg:col-span-5"
        empty={expenses.length === 0}
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
    </ReportRow>
    <Subscriptions />
  {/if}
  <SpendingCalendar />
</div>
