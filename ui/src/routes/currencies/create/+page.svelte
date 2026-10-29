<script lang="ts">
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import CurrencyForm from "../CurrencyForm.svelte";
</script>

<PageHeader
  crumbs={[
    { href: "/currencies", label: "Currencies" },
    { label: "Create a new currency" },
  ]}
  title="Create a new currency"
/>
<CurrencyForm />
