<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { lists } from "#lib/api/lists.js";
  import { Input } from "#lib/components/ui/input/index.js";

  let { id, value = $bindable("") }: { id: string; value: string } = $props();

  const groups = createQuery(() => lists.objectGroups());
</script>

<Input autocomplete="off" {id} list="{id}-list" bind:value />
<datalist id="{id}-list">
  {#each groups.data ?? [] as group (group.id)}
    <option value={group.attributes.title}></option>
  {/each}
</datalist>
