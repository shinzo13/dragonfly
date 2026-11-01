<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash from "@lucide/svelte/icons/trash-2";
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Split } from "#lib/api/types.js";
  import { toNumber } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Chip from "#lib/v2/components/Chip.svelte";
  import Tag from "#lib/v2/components/Tag.svelte";
  import TxEdit from "#lib/v2/components/TxEdit.svelte";
  import { q } from "#lib/v2/data.js";
  import { look } from "#lib/v2/look.svelte.js";
  import { money, view } from "#lib/v2/money.svelte.js";
  import { prettify, splitTitle, toRow } from "#lib/v2/tx.js";
  import { dateTime, longDate } from "#lib/v2/when.js";

  const id = $derived(page.params.id ?? "");
  const group = createQuery(() => q.group(id));
  const row = $derived(group.data ? toRow(group.data) : null);
  const created = $derived(group.data?.attributes.created_at ?? null);

  let confirming = $state(false);
  let editing = $state(false);
  let deleting = $state(false);

  const ASSETISH = new Set(["Asset account", "Debt", "Loan", "Mortgage", "Liability credit account"]);

  const valueOf = (s: Split) => Math.abs(view.conv(s.amount, s.currency_code) ?? view.fromPrimary(s.pc_amount));
  const total = $derived(row ? row.splits.reduce((sum, s) => sum + valueOf(s), 0) : 0);
  const sign = $derived(row?.kind === "out" ? -1 : 1);

  const byTag = $derived.by(() => {
    const map = new Map<string, number>();
    for (const s of row?.splits ?? []) {
      const key = s.tags?.[0] ?? "untagged";
      map.set(key, (map.get(key) ?? 0) + valueOf(s));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  });

  const tagColor = (tag: string) => (tag === "untagged" ? "var(--faint)" : look.of("tag", tag, tag).color);

  function accountHref(idValue: string | null | undefined, type: string | null | undefined) {
    if (!idValue) {
      return undefined;
    }
    return ASSETISH.has(type ?? "") ? `/acc/${idValue}` : `/tx?account=${idValue}`;
  }

  async function remove() {
    deleting = true;
    try {
      await api(`/v1/transactions/${id}`, { method: "DELETE" });
      await invalidate();
      goto("/tx");
    } finally {
      deleting = false;
    }
  }

  useKeys(() => [
    { group: "Page", keys: "e", label: "Edit name, account and notes", run: () => (editing = true) },
    { group: "Page", keys: "E", label: "Open the full editor", run: () => goto(`/transactions/edit/${id}`) },
    { group: "Page", keys: "Backspace", label: "Back to the list", run: () => history.back() },
  ]);

  const first = $derived(row?.splits[0]);
  const l = $derived(row?.categoryId ? look.of("category", row.categoryId, row.category ?? "") : { color: "#64748B", icon: row?.kind === "in" ? "arrow-down-left" : "arrow-left-right" });
</script>

<svelte:head><title>{row?.title ?? "Transaction"} · Dragonfly</title></svelte:head>

<div class="crumb">
  <a class="link" href="/tx">Transactions</a><ChevronRight size={15} /><b>{row?.title ?? "…"}</b>
  <span class="sp"></span>
  {#if !row}
    <span></span>
  {:else if confirming}
    <span class="small">Delete for good?</span>
    <button class="btn" onclick={() => (confirming = false)}>Keep</button>
    <button class="btn danger" disabled={deleting} onclick={remove}><Trash size={15} />Delete</button>
  {:else}
    <button class="btn danger" onclick={() => (confirming = true)}><Trash size={15} />Delete</button>
    <button class="btn primary" disabled={editing} onclick={() => (editing = true)}><Pencil size={15} />Edit<kbd class="on-dark">E</kbd></button>
  {/if}
</div>

{#if group.isPending}
  <div class="skeleton" style="height: 420px"></div>
{:else if group.isError || !row || !first}
  <section class="panel missing">
    <p>This transaction is gone or never existed.</p>
    <a class="btn" href="/tx">Back to transactions</a>
  </section>
{:else}
  {#if editing && group.data}
    <TxEdit group={group.data} onclose={() => (editing = false)} />
  {/if}
  <div class="layout">
    <section class="panel main">
      <div class="hero">
        <Chip color={l.color} icon={l.icon} size={56} />
        <div class="who">
          <div class="title">{row.title}</div>
          <div class="small when">{longDate(row.date)} · {row.type}</div>
        </div>
        <div class="amount">
          <div class="big" class:pos={row.kind === "in"} data-copy>{view.each(sign * total, sign * Math.abs(row.amount), row.code, { signed: row.kind === "in" })}</div>
          {#if view.foreign(row.code)}
            <div class="small" data-copy>{money(sign * Math.abs(row.amount), row.code, { signed: row.kind === "in" })}</div>
          {/if}
        </div>
      </div>

      {#if row.splits.length > 1 || row.tags.length}
        <div class="stack">
          {#each byTag as [tag, value] (tag)}
            <span style:flex={value} style:background={tagColor(tag)}></span>
          {/each}
        </div>
        <div class="legend small">
          {#each byTag as [tag, value] (tag)}
            <a class="leg" href={tag === "untagged" ? undefined : `/tx?tag=${encodeURIComponent(tag)}`}>
              <i class="dot" style:background={tagColor(tag)}></i>{tag}<span class="muted">{view.show(value)}</span>
            </a>
          {/each}
        </div>
      {/if}

      <h1 class="splits-head">{row.splits.length === 1 ? "Details" : `${row.splits.length} splits`}</h1>
      <div class="splits">
        {#each row.splits as split, i (i)}
          {@const sl = split.category_id ? look.of("category", split.category_id, split.category_name ?? "") : null}
          {@const name = row.splits.length > 1 ? splitTitle(split) : prettify(split.description)}
          {@const tags = (split.tags ?? []).filter((t) => t !== name)}
          <div class="split">
            <div class="split-line">
              {#if tags.length < (split.tags ?? []).length}
                <a aria-label="All {name}" class="dot-link" href="/tx?tag={encodeURIComponent(name)}"><i class="dot" style:background={tagColor(name)}></i></a>
              {/if}
              <span class="split-tags">
                {#each tags as tag (tag)}<Tag href="/tx?tag={encodeURIComponent(tag)}" {tag} />{/each}
              </span>
              <span class="split-name">{name}</span>
              {#if sl}
                <a class="small split-cat" href="/tx?category={split.category_id}"><i class="dot" style:background={sl.color}></i>{split.category_name}</a>
              {/if}
              <span class="split-sum" data-copy>{view.each(sign * valueOf(split), sign * Math.abs(toNumber(split.amount)), split.currency_code)}</span>
            </div>
            {#if split.notes}
              <pre class="notes">{split.notes}</pre>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <aside>
      <section class="panel">
        <div class="kv">
          <span>From</span>
          <a class="val" href={accountHref(first.source_id, first.source_type)}>
            {#if ASSETISH.has(first.source_type ?? "")}
              {@const a = look.of("account", first.source_id, first.source_name ?? "")}
              <Chip color={a.color} icon={a.icon} radius={6} size={22} />
            {/if}
            <span class="link">{first.source_name}</span>
          </a>
          <span>To</span>
          <a class="val" href={accountHref(first.destination_id, first.destination_type)}>
            {#if ASSETISH.has(first.destination_type ?? "")}
              {@const a = look.of("account", first.destination_id, first.destination_name ?? "")}
              <Chip color={a.color} icon={a.icon} radius={6} size={22} />
            {/if}
            <span class="link">{first.destination_name}</span>
          </a>
          {#if row.category}
            <span>Category</span>
            <a class="val" href="/tx?category={row.categoryId}">
              <Chip color={l.color} icon={l.icon} radius={6} size={22} /><span class="link">{row.category}</span>
            </a>
          {/if}
          {#if first.budget_name}
            <span>Budget</span>
            <a class="val" href="/tx?budget={first.budget_id}"><span class="link">{first.budget_name}</span></a>
          {/if}
          {#if first.bill_name ?? first.subscription_name}
            <span>Subscription</span>
            <a class="val" href="/control"><span class="link">{first.bill_name ?? first.subscription_name}</span></a>
          {/if}
          {#if row.tags.length}
            <span>Tags</span>
            <span class="val wrap">{#each row.tags as tag (tag)}<Tag href="/tx?tag={encodeURIComponent(tag)}" {tag} />{/each}</span>
          {/if}
        </div>
      </section>
      <section class="panel">
        <div class="kv quiet">
          {#if created}<span>Added</span><span class="val">{dateTime(created)}</span>{/if}
          <span>Bank text</span><span class="val mono">{first.description}</span>
          {#if first.foreign_amount && first.foreign_currency_code}
            <span>Foreign</span><span class="val">{money(toNumber(first.foreign_amount), first.foreign_currency_code)}</span>
          {/if}
          {#if first.external_id}<span>External ID</span><span class="val mono">{first.external_id}</span>{/if}
          <span>ID</span><span class="val">#{id}</span>
        </div>
        <a class="btn wide" data-sveltekit-reload href="/transactions/show/{id}?ffui=old"><ExternalLink size={15} />Open in firefly-legacy</a>
      </section>
      {#if row.kind === "move"}
        <section class="panel move small">
          {first.source_name}<ArrowRight size={14} />{first.destination_name}
        </section>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .crumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--mute);
    margin-bottom: 18px;
    min-height: 36px;
  }
  .crumb b {
    color: var(--ink);
  }
  .sp {
    flex: 1;
  }
  .on-dark {
    background: transparent;
    color: inherit;
    border-color: color-mix(in srgb, currentColor 30%, transparent);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 400px;
    gap: 20px;
    align-items: start;
  }
  .main {
    padding: 30px;
  }
  .hero {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .who {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 22px;
    font-weight: 800;
  }
  .when {
    font-size: 13.5px;
    margin-top: 2px;
    text-transform: none;
  }
  .amount {
    text-align: right;
  }
  .amount .big {
    font-size: 40px;
  }
  .stack {
    display: flex;
    height: 12px;
    border-radius: 6px;
    overflow: hidden;
    gap: 2px;
    margin: 28px 0 12px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
  }
  .leg {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--ink);
  }
  .splits-head {
    margin: 30px 0 8px;
  }
  .splits {
    margin: 0 -14px;
  }
  .split {
    padding: 10px 14px;
    border-radius: 12px;
  }
  .split:hover {
    background: var(--hover);
  }
  .split-line {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .dot-link {
    display: grid;
    place-items: center;
    width: 12px;
  }
  .split-tags {
    display: flex;
    gap: 4px;
    flex: none;
  }
  .split-name {
    flex: 1;
    font-size: 14.5px;
    font-weight: 700;
    min-width: 0;
  }
  .split-cat {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--ink);
  }
  .split-sum {
    width: 120px;
    text-align: right;
    font-size: 14.5px;
    font-weight: 800;
  }
  .notes {
    margin: 8px 0 2px;
    font: 600 12.5px/1.6 "Manrope Variable", system-ui;
    color: var(--mute);
    white-space: pre-wrap;
    padding-left: 12px;
    border-left: 1px solid var(--line);
  }
  aside {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .kv {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr);
    row-gap: 14px;
    font-size: 14px;
    font-weight: 600;
    align-items: center;
  }
  .kv > span:nth-child(odd) {
    color: var(--mute);
  }
  .kv.quiet {
    font-size: 13px;
    row-gap: 12px;
  }
  .val {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .wrap {
    flex-wrap: wrap;
    gap: 5px;
  }
  .mono {
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .wide {
    width: 100%;
    justify-content: center;
    margin-top: 18px;
  }
  .move {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .missing {
    text-align: center;
    padding: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--mute);
    font-weight: 600;
  }
  @media (max-width: 760px) {
    .crumb > .link,
    .crumb > :global(svg:first-of-type),
    .crumb kbd {
      display: none;
    }
    .crumb b {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
    .main {
      padding: 20px 18px;
    }
    .hero {
      flex-wrap: wrap;
    }
    .amount {
      flex-basis: 100%;
      text-align: left;
    }
    .amount .big {
      font-size: 34px;
    }
    .split-sum {
      width: auto;
    }
    .kv {
      grid-template-columns: 96px minmax(0, 1fr);
    }
  }
</style>
