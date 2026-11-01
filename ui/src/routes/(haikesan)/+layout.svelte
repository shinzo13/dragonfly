<script lang="ts">
  import QuickEntry from "#lib/components/QuickEntry.svelte";
  import Shell from "#lib/components/shell/Shell.svelte";

  let { children } = $props();
</script>

<Shell>
  {@render children()}
  {#snippet quick()}
    <QuickEntry />
  {/snippet}
</Shell>
