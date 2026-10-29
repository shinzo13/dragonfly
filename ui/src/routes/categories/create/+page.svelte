<script lang="ts">
  import CategoryForm from "#lib/components/categories/CategoryForm.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
</script>

<PageHeader
  crumbs={[{ href: "/categories", label: "Categories" }, { label: "Create" }]}
  title="Create a new category"
/>
<CategoryForm />
