<script lang="ts">
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import BillForm from "#lib/components/subscriptions/BillForm.svelte";
</script>

<PageHeader
  crumbs={[
    { href: "/subscriptions", label: "Subscriptions" },
    { label: "Create" },
  ]}
  title="Create a new subscription"
/>

<BillForm />
