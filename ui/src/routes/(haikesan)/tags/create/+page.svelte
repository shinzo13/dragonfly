<script lang="ts">
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import TagForm from "#lib/components/tags/TagForm.svelte";
</script>

<PageHeader
  crumbs={[{ href: "/tags", label: "Tags" }, { label: "Create" }]}
  title="Create a tag"
/>
<TagForm />
