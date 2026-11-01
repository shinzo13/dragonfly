<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Pencil from "@lucide/svelte/icons/pencil";
  import { createQuery } from "@tanstack/svelte-query";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import AccountCard from "#lib/v2/components/AccountCard.svelte";
  import BalancePanel from "#lib/v2/components/BalancePanel.svelte";
  import LookChip from "#lib/v2/components/LookChip.svelte";
  import AccountForm from "#lib/v2/forms/AccountForm.svelte";
  import TxRow from "#lib/v2/components/TxRow.svelte";
  import { q } from "#lib/v2/data.js";
  import { mobile } from "#lib/v2/mobile.svelte.js";
  import { view } from "#lib/v2/money.svelte.js";
  import { rowValue } from "#lib/v2/stats.js";
  import { byDay, type Row, toRow } from "#lib/v2/tx.js";
  import { dayLabel, periodName } from "#lib/v2/when.js";

  const id = $derived(page.params.id ?? "");
  const debt = $derived(page.url.searchParams.get("from") === "debts");
  const account = createQuery(() => q.account(id, period.end));
  const txs = createQuery(() => q.accountTransactions(id, period.start, period.end));

  const a = $derived(account.data?.attributes);
  let editing = $state(false);
  const isDebt = $derived(Boolean(a && a.type !== "asset"));
  const rows = $derived((txs.data ?? []).map(toRow));
  const dir = (row: Row) => (row.splits[0].source_id === id ? -1 : 1);
  const days = $derived(byDay(rows));
  const flat = $derived(days.flatMap(([, list]) => list));
  const flow = $derived.by(() => {
    let out = 0;
    let inn = 0;
    if (!view.ready) {
      return { inn, out };
    }
    for (const row of rows) {
      const v = dir(row) * rowValue(row);
      if (v < 0) {
        out -= v;
      } else {
        inn += v;
      }
    }
    return { inn, out };
  });
  const back = $derived(debt || a?.type === "liabilities" || a?.type === "liability" ? { href: "/debts", label: "Debts" } : { href: "/acc", label: "Accounts" });

  const nav = new ListNav<Row>({
    id: "acc-tx",
    items: () => flat,
    key: (row) => row.id,
    open: (row) => goto(`/tx/${row.id}`),
  });
  nav.use();
</script>

<svelte:head><title>{a?.name ?? "Account"} · Dragonfly</title></svelte:head>

<div class="crumb">
  <a class="link" href={back.href}>{back.label}</a><ChevronRight size={15} /><b>{a?.name ?? "…"}</b>
  <span class="sp"></span>
  <button class="btn" disabled={!account.data} onclick={() => (editing = true)} type="button"><Pencil size={15} />Edit</button>
</div>

{#if account.isPending}
  <div class="skeleton" style="height: 420px"></div>
{:else if !a}
  <section class="panel missing"><p>This account is gone.</p><a class="btn" href="/acc">All accounts</a></section>
{:else}
  <div class="layout">
    <div class="main">
      <div class="top">
        <AccountCard account={a} height={mobile.narrow ? 170 : 236} {id} />
        <section class="panel facts">
          <div class="flow">
            <div><div class="small">Out</div><div class="flow-sum">{view.show(flow.out, { decimals: 0 })}</div></div>
            <div><div class="small">In</div><div class="flow-sum pos">{view.show(flow.inn, { decimals: 0 })}</div></div>
          </div>
          <div class="kv">
            {#if a.iban}<span>IBAN</span><span>{a.iban}</span>{/if}
            {#if a.account_number}<span>Number</span><span>{a.account_number}</span>{/if}
            {#if a.notes}<span>Notes</span><span>{a.notes}</span>{/if}
            {#if a.last_activity}<span>Last activity</span><span>{dayLabel(a.last_activity.slice(0, 10))}</span>{/if}
          </div>
          <div class="look">
            <LookChip {id} kind="account" name={a.name} role={a.account_role ?? undefined} size={36} />
            <span class="small">Icon and colour</span>
            <a class="ib old" data-sveltekit-reload href="/accounts/show/{id}?ffui=old" title="Open in firefly-legacy"><ExternalLink size={15} /></a>
          </div>
        </section>
      </div>
      <BalancePanel accounts={[id]} height={mobile.narrow ? 200 : 380} label="Balance" showValue={false} />
    </div>

    <section class="panel list">
      {#if txs.isPending}
        {#each Array.from({ length: 8 }, (_, i) => i) as i (i)}<div class="skeleton" style="height: 38px; margin: 10px 16px"></div>{/each}
      {:else if rows.length === 0}
        <p class="empty">No transactions in {periodName(period.start, period.end)}.</p>
      {:else}
        {#each days as [day, list] (day)}
          {@const net = list.reduce((s, r) => s + dir(r) * rowValue(r), 0)}
          <div class="day"><span>{dayLabel(day)}</span><span class:pos={net > 0} class:muted={net <= 0}>{net ? view.show(net, { signed: true }) : ""}</span></div>
          {#each list as row (row.id)}
            {@const index = flat.indexOf(row)}
            <TxRow compact cursor={nav.cursor === index} dir={dir(row)} id={nav.rowId(index)} {row} showAccount={false} />
          {/each}
        {/each}
      {/if}
    </section>
  </div>
{/if}

{#if account.data}
  <AccountForm account={account.data} bind:open={editing} kind={isDebt ? "debt" : "asset"} />
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
  }
  .crumb b {
    color: var(--ink);
  }
  .sp {
    flex: 1;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 560px;
    gap: 20px;
    align-items: start;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  .top {
    display: grid;
    grid-template-columns: minmax(300px, 400px) minmax(0, 1fr);
    gap: 20px;
  }
  .facts {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 22px;
  }
  .flow {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .flow-sum {
    font-size: 20px;
    font-weight: 800;
  }
  .kv {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    row-gap: 8px;
    font-size: 13px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .kv > span:nth-child(odd) {
    color: var(--mute);
  }
  .look {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: auto;
  }
  .old {
    margin-left: auto;
    width: 32px;
    height: 32px;
  }
  .list {
    padding: 8px 12px 12px;
  }
  .day {
    display: flex;
    gap: 10px;
    padding: 16px 16px 6px;
    font-size: 12.5px;
    font-weight: 700;
  }
  .empty,
  .missing {
    padding: 60px 20px;
    text-align: center;
    color: var(--mute);
    font-weight: 600;
  }
  @media (max-width: 760px) {
    .crumb {
      margin-bottom: 12px;
    }
    .layout,
    .top {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
    .main {
      gap: 14px;
    }
    .list {
      padding: 4px 8px 8px;
    }
    .day {
      padding: 14px 6px 2px;
    }
  }
</style>
