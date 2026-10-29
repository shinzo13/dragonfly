<script lang="ts">
  import type { Account, Item } from "#lib/api/types.js";
  import AutocompleteInput, {
    type Option,
  } from "#lib/components/inputs/AutocompleteInput.svelte";
  import type { Catalog } from "./catalog.svelte.js";
  import { type AccountRef, emptyAccount, toAccountRef } from "./model.js";

  let {
    value = $bindable(),
    catalog,
    kinds,
    free = false,
    id,
    invalid = false,
    disabled = false,
    placeholder = "",
    onpick,
  }: {
    value: AccountRef;
    catalog: Catalog;
    kinds: string[];
    free?: boolean;
    id: string;
    invalid?: boolean;
    disabled?: boolean;
    placeholder?: string;
    onpick?: (value: AccountRef) => void;
  } = $props();

  function setText(text: string) {
    if (text !== value.name) {
      value = { ...emptyAccount(), name: text };
    }
  }

  function setSelected(option: Option | null) {
    if (option?.data) {
      value = toAccountRef(option.data as Item<Account>);
    }
  }
</script>

<AutocompleteInput
  {disabled}
  {free}
  {id}
  {invalid}
  onpick={() => onpick?.(value)}
  openOnFocus={!free}
  {placeholder}
  search={(query) => catalog.accountOptions(kinds, query)}
  bind:selected={
    () => (value.id ? { id: value.id, label: value.name } : null),
    setSelected
  }
  bind:value={() => value.name, setText}
/>
