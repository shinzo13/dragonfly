<script lang="ts">
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import LinkTypeForm from "../LinkTypeForm.svelte";
</script>

<PageHeader
  crumbs={[
    { href: "/settings", label: "System settings" },
    { href: "/settings/links", label: "Transaction links configuration" },
    { label: "Create new link type" },
  ]}
  subtitle="Create new link type"
  title="System settings"
/>
<LinkTypeForm />
