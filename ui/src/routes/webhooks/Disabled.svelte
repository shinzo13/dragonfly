<script lang="ts">
  import OldUi from "#lib/components/misc/OldUi.svelte";

  let { href = "/webhooks/index?ffui=old" }: { href?: string } = $props();
</script>

<OldUi {href}>
  Webhooks are switched off in this Firefly III (ALLOW_WEBHOOKS=false).
</OldUi>
