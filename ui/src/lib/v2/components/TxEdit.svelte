<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate, lists } from "#lib/api/lists.js";
  import type { Item, TransactionGroup } from "#lib/api/types.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { look } from "../look.svelte.js";
  import { splitTitle } from "../tx.js";
  import Filter from "./Filter.svelte";

  let { group, onclose }: { group: Item<TransactionGroup>; onclose: () => void } = $props();

  const splits = $derived(group.attributes.transactions);
  const multi = $derived(splits.length > 1);
  const first = $derived(splits[0]);

  const initial = untrack(() => ({
    notes: group.attributes.transactions.map((s) => s.notes ?? ""),
    source: group.attributes.transactions[0].source_id,
    title:
      group.attributes.transactions.length > 1
        ? (group.attributes.group_title ?? "")
        : group.attributes.transactions[0].description,
  }));

  let title = $state(initial.title);
  let source = $state<string | null>(initial.source);
  let notes = $state(initial.notes);
  let saving = $state(false);
  let error = $state("");

  const accounts = createQuery(() => lists.accounts("all"));

  const KIND: Record<string, string> = { asset: "", liabilities: "debt", liability: "debt", revenue: "income source" };
  const allowed = $derived(first.type === "deposit" ? ["revenue", "liabilities", "liability", "asset"] : ["asset", "liabilities", "liability"]);

  const options = $derived(
    (accounts.data ?? [])
      .filter((a) => allowed.includes(a.attributes.type) && (a.attributes.active || a.id === first.source_id))
      .sort((a, b) => allowed.indexOf(a.attributes.type) - allowed.indexOf(b.attributes.type))
      .map((a) => ({
        id: a.id,
        label: KIND[a.attributes.type] ? `${a.attributes.name} · ${KIND[a.attributes.type]}` : a.attributes.name,
        look: a.attributes.type === "revenue" ? undefined : look.of("account", a.id, a.attributes.name, a.attributes.account_role ?? undefined),
      }))
  );

  async function save() {
    if (!title.trim()) {
      error = "Give it a name";
      return;
    }
    saving = true;
    error = "";
    try {
      await api(`/v1/transactions/${group.id}`, {
        body: {
          ...(multi && { group_title: title.trim() }),
          transactions: splits.map((s, i) => ({
            transaction_journal_id: s.transaction_journal_id,
            ...(!multi && { description: title.trim() }),
            ...(source && source !== s.source_id && { source_id: source }),
            notes: notes[i] ?? "",
          })),
        },
        method: "PUT",
      });
      await invalidate();
      onclose();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  useKeys(() => [
    { group: "Page", input: true, keys: "mod+Enter", label: "Save", run: save },
    { group: "Page", input: true, keys: "Escape", label: "Cancel editing", run: onclose },
  ]);
</script>

<form
  class="panel edit"
  onsubmit={(event) => {
    event.preventDefault();
    save();
  }}
>
  <label class="field-row">
    <span class="small">Name</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input autofocus bind:value={title} class="field" />
  </label>
  <div class="field-row">
    <span class="small">{first.type === "deposit" ? "From" : "Paid from"}</span>
    <div class="pick">
      <Filter label={first.source_name ?? "Choose"} onchange={(id) => (source = id ?? first.source_id)} {options} value={source} />
      {#if first.type === "deposit"}
        <span class="small hint">Pick a debt to mark this as a repayment</span>
      {/if}
    </div>
  </div>
  {#each splits as split, i (split.transaction_journal_id)}
    <label class="field-row top">
      <span class="small">{multi ? `Notes · ${splitTitle(split)}` : "Notes"}</span>
      <textarea bind:value={notes[i]} class="field area" rows={Math.max(2, (notes[i] ?? "").split("\n").length)}></textarea>
    </label>
  {/each}
  {#if error}<p class="error">{error}</p>{/if}
  <div class="actions">
    <span class="small">More fields in the <a class="link" href="/transactions/edit/{group.id}">full editor</a></span>
    <span class="sp"></span>
    <button class="btn" onclick={onclose} type="button">Cancel <kbd>Esc</kbd></button>
    <button class="btn primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save"}</button>
  </div>
</form>

<style>
  .edit {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 20px;
    box-shadow: 0 0 0 2px var(--acc-soft), var(--shadow);
  }
  .field-row {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    align-items: center;
    gap: 16px;
  }
  .field-row.top {
    align-items: start;
  }
  .field-row.top .small {
    padding-top: 10px;
  }
  .field {
    width: 100%;
  }
  .area {
    height: auto;
    padding: 9px 12px;
    resize: vertical;
    line-height: 1.5;
  }
  .pick {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .hint {
    color: var(--faint);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .sp {
    flex: 1;
  }
  .actions kbd {
    margin-left: 4px;
  }
  .error {
    color: var(--neg);
    font-size: 13px;
    font-weight: 600;
  }
</style>
