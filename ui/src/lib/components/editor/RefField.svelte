<script lang="ts">
  import AutocompleteInput, {
    type Option,
  } from "#lib/components/inputs/AutocompleteInput.svelte";
  import type { Ref } from "./model.js";

  let {
    value = $bindable(),
    search,
    id,
    invalid = false,
    placeholder = "",
    onpick,
  }: {
    value: Ref;
    search: (query: string) => Option[];
    id: string;
    invalid?: boolean;
    placeholder?: string;
    onpick?: (option: Option) => void;
  } = $props();
</script>

<AutocompleteInput
  {id}
  {invalid}
  {onpick}
  openOnFocus
  {placeholder}
  {search}
  bind:selected={
    () => (value.id ? { id: value.id, label: value.name } : null),
    (option) => {
    if (option) {
      value = { id: option.id, name: option.label };
    }
  }
  }
  bind:value={
    () => value.name,
    (text) => {
    if (text !== value.name) {
      value = { id: null, name: text };
    }
  }
  }
/>
