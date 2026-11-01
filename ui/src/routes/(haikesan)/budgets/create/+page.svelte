<script lang="ts">
  import BudgetForm from "#lib/components/budgets/BudgetForm.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
</script>

<PageHeader
  crumbs={[{ href: "/budgets", label: "Budgets" }, { label: "Create" }]}
  title="Create a new budget"
/>
<BudgetForm />
