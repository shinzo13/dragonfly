<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { createQuery } from "@tanstack/svelte-query";
  import { stepPeriod } from "#lib/dates.js";
  import { period } from "#lib/period.svelte.js";
  import BalancePanel from "#lib/v2/components/BalancePanel.svelte";
  import Chip from "#lib/v2/components/Chip.svelte";
  import Filter from "#lib/v2/components/Filter.svelte";
  import { q } from "#lib/v2/data.js";
  import { look } from "#lib/v2/look.svelte.js";
  import { mobile } from "#lib/v2/mobile.svelte.js";
  import { money, view } from "#lib/v2/money.svelte.js";
  import { balanceOf, spendByCategory, totals, worth } from "#lib/v2/stats.js";
  import { toRow } from "#lib/v2/tx.js";
  import { hidden } from "#lib/v2/hidden.svelte.js";
  import { periodName } from "#lib/v2/when.js";

  const prev = $derived(stepPeriod(period.range, period.view, -1));

  const accounts = createQuery(() => q.accounts("asset", period.end));
  const txs = createQuery(() => q.transactions(period.start, period.end));
  const prevTxs = createQuery(() => q.transactions(prev.start, prev.end));

  const rows = $derived((txs.data ?? []).map(toRow));
  const slices = $derived(view.ready ? spendByCategory(rows) : []);
  const sum = $derived(view.ready ? totals(rows) : { earned: 0, spent: 0 });
  const prevSum = $derived(view.ready ? totals((prevTxs.data ?? []).map(toRow)) : null);
  const total = $derived(view.ready ? worth(accounts.data) : 0);
  const max = $derived(slices[0]?.value ?? 1);
  const active = $derived((accounts.data ?? []).filter((a) => a.attributes.active && !hidden.has(a.id)));
  const prevName = $derived(periodName(prev.start, prev.end));
  let picked = $state<string | null>(null);
  const accountOptions = $derived(active.map((a) => ({ id: a.id, label: a.attributes.name, look: look.of("account", a.id, a.attributes.name, a.attributes.account_role ?? undefined) })));

  const show = (v: number, decimals = 2) => view.show(v, { decimals });
</script>

<svelte:head><title>Overview · Dragonfly</title></svelte:head>

{#snippet spentPanel(limit: number)}
  <section class="panel spent">
    <div class="spent-head">
      <h1>Spent</h1>
      <span class="sum" data-copy>{show(sum.spent, 0)}</span>
    </div>
    <div class="small">
      {#if prevSum}
        {@const diff = sum.spent - prevSum.spent}
        {money(Math.abs(diff), view.code, { decimals: 0 })} {diff <= 0 ? "less" : "more"} than {prevName} ·
      {/if}
      earned <a class="pos link" href="/tx?type=deposit">{show(sum.earned, 0)}</a>
    </div>
    {#if slices.length}
      <div class="stack">
        {#each slices as slice (slice.id ?? "none")}
          <span style:flex={slice.value} style:background={look.of("category", slice.id, slice.name).color}></span>
        {/each}
      </div>
      <div class="cats">
        {#each slices.slice(0, limit) as slice (slice.id ?? "none")}
          {@const l = look.of("category", slice.id, slice.name)}
          <a class="cat" href={slice.id ? `/tx?category=${slice.id}&type=withdrawal` : "/tx?category=none&type=withdrawal"}>
            <Chip color={l.color} icon={l.icon} size={32} />
            <div class="cat-body">
              <div class="cat-line"><span class="name">{slice.name}</span><span>{show(slice.value, 0)}</span></div>
              <div class="bar"><div style:width="{(slice.value / max) * 100}%" style:background={l.color}></div></div>
            </div>
            <ChevronRight class="go" size={16} />
          </a>
        {/each}
      </div>
    {:else if txs.isPending}
      <div class="skeleton" style="height: 360px; margin-top: 20px"></div>
    {:else}
      <p class="empty muted">Nothing spent in this period.</p>
    {/if}
  </section>
{/snippet}

{#snippet balance(height: number)}
  <BalancePanel accounts={picked ? [picked] : undefined} fill {height} label={picked ? "Balance" : "Total balance"} total={picked ? null : total}>
    {#snippet picker()}
      <Filter label="All accounts" onchange={(id) => (picked = id)} options={accountOptions} value={picked} />
    {/snippet}
  </BalancePanel>
{/snippet}

{#if mobile.narrow}
  <div class="m">
    {@render balance(180)}
    {@render spentPanel(5)}
    <section class="panel list">
        {#each active as a (a.id)}
          {@const l = look.of("account", a.id, a.attributes.name, a.attributes.account_role ?? undefined)}
          <a class="acc-row" href="/acc/{a.id}">
            <Chip color={l.color} icon={l.icon} size={36} />
            <span class="acc-name">{a.attributes.name}</span>
            <span class="acc-val">
              <b data-copy>{view.original ? money(Number(a.attributes.current_balance), a.attributes.currency_code ?? "") : show(balanceOf(a.attributes))}</b>
              {#if view.foreign(a.attributes.currency_code)}<small data-copy>{money(Number(a.attributes.current_balance), a.attributes.currency_code ?? "")}</small>{/if}
            </span>
          </a>
        {/each}
      </section>
  </div>
{:else}
<div class="top">
  {@render balance(260)}

  {@render spentPanel(9)}
</div>

<div class="strip">
  {#each active as a (a.id)}
    {@const l = look.of("account", a.id, a.attributes.name, a.attributes.account_role ?? undefined)}
    <a class="panel acc" href="/acc/{a.id}">
      <Chip color={l.color} icon={l.icon} size={36} />
      <div class="acc-body">
        <div class="small">{a.attributes.name}</div>
        <div class="acc-sum" data-copy>{view.original ? money(Number(a.attributes.current_balance), a.attributes.currency_code ?? "") : show(balanceOf(a.attributes))}</div>
        {#if view.foreign(a.attributes.currency_code)}
          <div class="small orig" data-copy>{money(Number(a.attributes.current_balance), a.attributes.currency_code ?? "")}</div>
        {/if}
      </div>
    </a>
  {/each}
</div>
{/if}

<style>
  .m {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .list {
    padding: 8px 10px;
  }
  .acc-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 6px;
  }
  .acc-row + .acc-row {
    border-top: 1px solid var(--line);
  }
  .acc-name {
    flex: 1;
    font-size: 15px;
    font-weight: 700;
  }
  .acc-val {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.2;
  }
  .acc-val b {
    font-size: 15px;
    font-weight: 800;
  }
  .acc-val small {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--mute);
  }
  .top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 430px;
    gap: 20px;
  }
  .spent-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .sum {
    font-size: 16px;
    font-weight: 800;
  }
  .stack {
    display: flex;
    height: 10px;
    border-radius: 6px;
    overflow: hidden;
    gap: 2px;
    margin: 20px 0;
  }
  .cats {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 -10px;
  }
  .cat {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 10px;
    border-radius: 12px;
    transition: background 0.15s;
  }
  .cat:hover {
    background: var(--hover);
  }
  .cat :global(.go) {
    color: var(--faint);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .cat:hover :global(.go) {
    opacity: 1;
  }
  .cat-body {
    flex: 1;
    min-width: 0;
  }
  .cat-line {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar {
    height: 4px;
  }
  .empty {
    padding: 40px 0;
    text-align: center;
    font-weight: 600;
  }
  .strip {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
    margin-top: 20px;
  }
  .acc {
    padding: 15px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-radius: 18px;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .acc:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px -10px #00000040;
  }
  .acc-body {
    min-width: 0;
  }
  .acc-sum {
    font-size: 15px;
    font-weight: 800;
    margin-top: 1px;
  }
  .orig {
    font-size: 11px;
  }
  @media (max-width: 1100px) {
    .top {
      grid-template-columns: 1fr;
    }
  }
</style>
