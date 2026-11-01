<script lang="ts">
  import PiggyForm from "#lib/components/piggy-banks/PiggyForm.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
</script>

<PageHeader
  crumbs={[{ href: "/piggy-banks", label: "Piggy banks" }, { label: "Create" }]}
  title="Create a new piggy bank"
/>

<PiggyForm />
