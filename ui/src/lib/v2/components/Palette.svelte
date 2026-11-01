<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import { createQuery } from "@tanstack/svelte-query";
  import { lists } from "#lib/api/lists.js";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { keys, prettyKeys } from "#lib/keys.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { goto } from "$app/navigation";
  import { look, type LookKind } from "../look.svelte.js";
  import Chip from "./Chip.svelte";

  interface Entry {
    id: string;
    group: string;
    label: string;
    hint?: string;
    keys?: string;
    icon?: { icon: string; color: string };
    run: () => void;
  }

  let dialog = $state<HTMLDialogElement>();
  let input = $state<HTMLInputElement>();
  let cursor = $state(0);

  const on = () => ui.palette;
  const accounts = createQuery(() => ({ ...lists.accounts("all"), enabled: on() }));
  const categories = createQuery(() => ({ ...lists.categories(), enabled: on() }));
  const tags = createQuery(() => ({ ...lists.tags(), enabled: on() }));
  const budgets = createQuery(() => ({ ...lists.budgets(), enabled: on() }));

  const go = (href: string) => () => goto(href);

  function entity(kind: LookKind, group: string, id: string, label: string, href: string, role?: string): Entry {
    return { group, icon: look.of(kind, id, label, role), id: `${kind}:${id}`, label, run: go(href) };
  }

  const entries = $derived.by(() => {
    const out: Entry[] = [];
    const actions: Entry[] = [];
    for (const binding of keys.all) {
      if (binding.group === "Go to" || binding.group === "Everywhere") {
        if (binding.keys !== "mod+k") {
          actions.push({ group: "Actions", id: `key:${binding.keys}`, keys: binding.keys, label: binding.label, run: () => binding.run(new KeyboardEvent("keydown")) });
        }
      }
    }
    for (const a of accounts.data ?? []) {
      const t = a.attributes.type;
      if (t === "asset" || t === "liabilities" || t === "liability") {
        out.push(entity("account", t === "asset" ? "Accounts" : "Debts", a.id, a.attributes.name, `/acc/${a.id}`, a.attributes.account_role ?? undefined));
      }
    }
    for (const c of categories.data ?? []) {
      out.push(entity("category", "Categories", c.id, c.attributes.name, `/tx?category=${c.id}`));
    }
    for (const t of tags.data ?? []) {
      out.push(entity("tag", "Tags", t.attributes.tag, t.attributes.tag, `/tx?tag=${encodeURIComponent(t.attributes.tag)}`));
    }
    for (const b of budgets.data ?? []) {
      out.push(entity("budget", "Budgets", b.id, b.attributes.name, `/tx?budget=${b.id}`));
    }
    return [...out, ...actions];
  });

  const shown = $derived(fuzzyFilter(entries, ui.paletteQuery, (e) => `${e.label} ${e.group}`, 60));

  $effect(() => {
    if (ui.palette && dialog && !dialog.open) {
      dialog.showModal();
      cursor = 0;
      requestAnimationFrame(() => input?.focus());
    } else if (!ui.palette && dialog?.open) {
      dialog.close();
    }
  });

  $effect(() => {
    ui.paletteQuery;
    cursor = 0;
  });

  function run(entry: Entry | undefined) {
    if (!entry) {
      return;
    }
    ui.palette = false;
    entry.run();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) {
      event.preventDefault();
      cursor = Math.min(shown.length - 1, cursor + 1);
    } else if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
      event.preventDefault();
      cursor = Math.max(0, cursor - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(shown[cursor]);
    }
    document.getElementById(`pal-${cursor}`)?.scrollIntoView({ block: "nearest" });
  }
</script>

<dialog
  bind:this={dialog}
  aria-label="Jump to"
  onclick={(event) => event.target === dialog && (ui.palette = false)}
  onclose={() => (ui.palette = false)}
>
  <div class="box">
    <label class="head">
      <Search size={18} />
      <input bind:this={input} bind:value={ui.paletteQuery} {onkeydown} placeholder="Jump to an account, category, tag or action" />
      <kbd>Esc</kbd>
    </label>
    <div class="list">
      {#each shown as entry, i (entry.id)}
        {#if i === 0 || shown[i - 1].group !== entry.group}
          <div class="group">{entry.group}</div>
        {/if}
        <button class="row" class:on={i === cursor} id="pal-{i}" onclick={() => run(entry)} onpointermove={() => (cursor = i)}>
          {#if entry.icon}<Chip color={entry.icon.color} icon={entry.icon.icon} size={24} />{/if}
          <span class="text">{entry.label}</span>
          {#if entry.keys}
            <span class="keys">{#each prettyKeys(entry.keys) as key, k (k)}<kbd>{key}</kbd>{/each}</span>
          {/if}
        </button>
      {:else}
        <div class="empty">Nothing matches “{ui.paletteQuery}”</div>
      {/each}
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: 0;
    padding: 0;
    background: transparent;
    margin: 12vh auto auto;
    width: min(620px, calc(100vw - 32px));
    max-height: 70vh;
    overflow: visible;
  }
  dialog::backdrop {
    background: var(--scrim, #0006);
  }
  .box {
    background: var(--panel);
    color: var(--ink);
    border-radius: 18px;
    box-shadow: var(--pop);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 70vh;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    height: 58px;
    border-bottom: 1px solid var(--line);
    color: var(--mute);
  }
  input {
    flex: 1;
    border: 0;
    background: none;
    outline: none !important;
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
  }
  input::placeholder {
    color: var(--faint);
  }
  .list {
    overflow-y: auto;
    padding: 6px 8px 10px;
  }
  .group {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--faint);
    padding: 12px 10px 6px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 40px;
    padding: 0 10px;
    border: 0;
    border-radius: 10px;
    background: none;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .row.on {
    background: var(--sunk);
  }
  .text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .keys {
    display: flex;
    gap: 4px;
  }
  .empty {
    padding: 28px;
    text-align: center;
    color: var(--mute);
    font-weight: 600;
  }
</style>
