<script lang="ts" module>
  export interface Option {
    id: string;
    label: string;
    look?: { icon: string; color: string };
  }
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import X from "@lucide/svelte/icons/x";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { mobile } from "../mobile.svelte.js";
  import Chip from "./Chip.svelte";
  import Menu from "./Menu.svelte";

  let {
    label,
    options,
    value,
    onchange,
  }: { label: string; options: Option[]; value: string | null; onchange: (id: string | null) => void } = $props();

  let query = $state("");
  const chosen = $derived(options.find((o) => o.id === value));
  const shown = $derived(fuzzyFilter(options, query, (o) => o.label, 200));
</script>

<Menu sheet={mobile.narrow} width={260}>
  {#snippet trigger({ toggle })}
    <div class="trigger" class:set={chosen}>
      <button type="button" class="open" onclick={toggle}>
        {#if chosen?.look}<Chip color={chosen.look.color} icon={chosen.look.icon} size={18} radius={5} />{/if}
        <span>{chosen?.label ?? label}</span>
        {#if !chosen}<ChevronDown size={14} />{/if}
      </button>
      {#if chosen}
        <button type="button" aria-label="Clear {label}" class="clear" onclick={() => onchange(null)}><X size={14} /></button>
      {/if}
    </div>
  {/snippet}
  {#snippet children({ close })}
    {#if options.length > 8}
      <!-- svelte-ignore a11y_autofocus -->
      <input autofocus={!mobile.narrow} bind:value={query} class="field find" placeholder="Find {label.toLowerCase()}" />
    {/if}
    <div class="list">
      {#each shown as option (option.id)}
        <button type="button"
          class="item"
          onclick={() => {
            onchange(option.id);
            query = "";
            close();
          }}
        >
          {#if option.look}<Chip color={option.look.color} icon={option.look.icon} size={22} radius={6} />{/if}
          <span class="text">{option.label}</span>
          {#if option.id === value}<span class="hint"><Check size={15} /></span>{/if}
        </button>
      {/each}
    </div>
  {/snippet}
</Menu>

<style>
  .trigger {
    display: flex;
    align-items: center;
    height: 38px;
    border-radius: 11px;
    border: 1px solid var(--line);
    background: var(--panel);
  }
  .trigger.set {
    background: var(--acc-soft);
    border-color: transparent;
  }
  button {
    border: 0;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 100%;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .open {
    padding: 0 12px;
    max-width: 200px;
  }
  .open span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .set .open {
    padding-right: 4px;
  }
  .clear {
    padding: 0 10px 0 4px;
    color: var(--mute);
  }
  .find {
    width: 100%;
    margin-bottom: 4px;
  }
  .list {
    max-height: 320px;
    overflow-y: auto;
  }
  @media (max-width: 760px) {
    .find {
      flex: none;
      height: 46px;
      margin-bottom: 6px;
      font-size: 16px;
    }
    .list {
      flex: 1;
      min-height: 0;
      max-height: none;
      overscroll-behavior: contain;
    }
  }
  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
