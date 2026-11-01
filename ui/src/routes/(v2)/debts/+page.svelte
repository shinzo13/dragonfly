<script lang="ts">
  import ArrowDownLeft from "@lucide/svelte/icons/arrow-down-left";
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import Plus from "@lucide/svelte/icons/plus";
  import { createQueries, createQuery } from "@tanstack/svelte-query";
  import { toNumber } from "#lib/format.js";
  import { period } from "#lib/period.svelte.js";
  import Glyph from "#lib/v2/components/Glyph.svelte";
  import AccountForm from "#lib/v2/forms/AccountForm.svelte";
  import { q } from "#lib/v2/data.js";
  import { look } from "#lib/v2/look.svelte.js";
  import { money, view } from "#lib/v2/money.svelte.js";
  import { balanceOf } from "#lib/v2/stats.js";
  import { toRow } from "#lib/v2/tx.js";
  import { shortDate } from "#lib/v2/when.js";

  const accounts = createQuery(() => q.accounts("liabilities", period.end));
  let creating = $state(false);
  const open = $derived((accounts.data ?? []).filter((a) => a.attributes.active && toNumber(a.attributes.current_balance) !== 0));
  const settled = $derived((accounts.data ?? []).filter((a) => !(a.attributes.active && toNumber(a.attributes.current_balance) !== 0)));

  const history = createQueries(() => ({
    queries: open.map((a) => q.accountTransactions(a.id)),
  }));

  const credit = (a: { liability_direction?: string | null }) => a.liability_direction !== "debit";
  const owedToMe = $derived(view.ready ? open.filter((a) => credit(a.attributes)).reduce((s, a) => s + Math.abs(balanceOf(a.attributes)), 0) : 0);
  const iOwe = $derived(view.ready ? open.filter((a) => !credit(a.attributes)).reduce((s, a) => s + Math.abs(balanceOf(a.attributes)), 0) : 0);

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

  const customized = (id: string) => Boolean(look.looks[`account:${id}`]?.icon);
</script>

<svelte:head><title>Debts · Dragonfly</title></svelte:head>

<div class="head">
  <div class="totals">
    <div>
      <div class="small label">Owed to you</div>
      <div class="big total">{view.show(owedToMe)}</div>
    </div>
    {#if iOwe > 0}
      <div>
        <div class="small label">You owe</div>
        <div class="big total neg">{view.show(iOwe)}</div>
      </div>
    {/if}
  </div>
  <button class="btn primary" onclick={() => (creating = true)} type="button"><Plus size={15} />New debt</button>
</div>

{#if accounts.isPending}
  <div class="grid">{#each [0, 1] as i (i)}<div class="skeleton" style="height: 300px; border-radius: 20px"></div>{/each}</div>
{:else if open.length === 0}
  <section class="panel empty">Nobody owes anybody. Nice.</section>
{:else}
  <div class="grid">
    {#each open as a, i (a.id)}
      {@const at = a.attributes}
      {@const l = look.of("account", a.id, at.name)}
      {@const mine = credit(at)}
      {@const left = Math.abs(toNumber(at.current_balance))}
      {@const start = Math.max(Math.abs(toNumber(at.opening_balance)), left)}
      {@const paid = start - left}
      {@const payments = (history[i]?.data ?? []).map(toRow).filter((r) => r.splits[0].source_id === a.id || r.splits[0].destination_id === a.id).slice(0, 4)}
      <a class="panel debt" href="/acc/{a.id}?from=debts">
        <div class="who">
          <span class="avatar" style:background={l.color}>
            {#if customized(a.id)}<Glyph name={l.icon} size={22} />{:else}{initials(at.name)}{/if}
          </span>
          <div class="name">
            <div class="title">{at.name}</div>
            <div class="small">{mine ? "owes you" : "you owe"}{at.opening_balance_date ? ` · since ${shortDate(at.opening_balance_date.slice(0, 10))}` : ""}</div>
          </div>
          <div class="amount">
            <div class="big" class:neg={!mine} data-copy>{view.each(Math.abs(balanceOf(at)), left, at.currency_code)}</div>
            {#if view.foreign(at.currency_code)}<div class="small" data-copy>{money(left, at.currency_code ?? "")}</div>{/if}
          </div>
        </div>
        <div class="bar progress"><div style:width="{start ? (paid / start) * 100 : 0}%" style:background={l.color}></div></div>
        <div class="small scale">
          <span>{paid > 0 ? `${money(paid, at.currency_code ?? "", { decimals: 0 })} back` : "nothing back yet"}</span>
          <span>of {money(start, at.currency_code ?? "", { decimals: 0 })}</span>
        </div>
        <hr class="rule" />
        {#if payments.length}
          {#each payments as p (p.id)}
            {@const back = p.splits[0].source_id === a.id}
            <div class="pay">
              <span class="pay-icon" class:back>{#if back}<ArrowDownLeft size={15} />{:else}<ArrowUpRight size={15} />{/if}</span>
              <span class="pay-name">{back === mine ? "Paid back" : "Lent"}</span>
              <span class="small">{shortDate(p.date)}</span>
              <span class="pay-sum" class:pos={back}>{money(Math.abs(p.amount), p.code, { signed: back })}</span>
            </div>
          {/each}
        {:else}
          <p class="small none">Repayments show up here once they hit an account.</p>
        {/if}
      </a>
    {/each}
  </div>
{/if}

{#if settled.length}
  <div class="small settled-label">Settled</div>
  <div class="settled">
    {#each settled as a (a.id)}
      {@const l = look.of("account", a.id, a.attributes.name)}
      <a class="panel row" href="/acc/{a.id}?from=debts">
        <span class="avatar small-avatar" style:background={l.color}>{initials(a.attributes.name)}</span>
        <span class="row-name">{a.attributes.name}</span>
        <span class="sp"></span>
        <span class="small">{money(toNumber(a.attributes.current_balance), a.attributes.currency_code ?? "")}</span>
      </a>
    {/each}
  </div>
{/if}

<AccountForm bind:open={creating} kind="debt" />

<style>
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .totals {
    display: flex;
    gap: 48px;
  }
  .label {
    font-size: 14px;
  }
  .total {
    font-size: 40px;
    margin-top: 4px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(520px, 1fr));
    gap: 20px;
  }
  .debt {
    padding: 26px;
    display: block;
    transition: box-shadow 0.18s, transform 0.18s;
  }
  .debt:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px -18px #00000066;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #fff;
    font-weight: 800;
    font-size: 17px;
    flex: none;
  }
  .name {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 18px;
    font-weight: 800;
  }
  .amount {
    text-align: right;
  }
  .amount .big {
    font-size: 32px;
  }
  .progress {
    height: 8px;
    margin: 24px 0 10px;
  }
  .scale {
    display: flex;
    justify-content: space-between;
  }
  .rule {
    margin: 20px 0 8px;
  }
  .pay {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 0;
    font-size: 14px;
    font-weight: 700;
  }
  .pay-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--sunk);
    color: var(--mute);
  }
  .pay-icon.back {
    background: color-mix(in srgb, var(--pos) 16%, transparent);
    color: var(--pos);
  }
  .pay-sum {
    margin-left: auto;
  }
  .none {
    padding: 8px 0;
  }
  .empty {
    text-align: center;
    padding: 60px;
    color: var(--mute);
    font-weight: 600;
  }
  .settled-label {
    margin: 28px 0 10px 4px;
  }
  .settled {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .row {
    padding: 12px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    opacity: 0.75;
    transition: opacity 0.15s;
  }
  .row:hover {
    opacity: 1;
  }
  .small-avatar {
    width: 36px;
    height: 36px;
    font-size: 13px;
    background: #64748b;
  }
  .row-name {
    font-size: 15px;
    font-weight: 700;
  }
  .sp {
    flex: 1;
  }
  @media (max-width: 760px) {
    .head {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 14px;
    }
    .totals {
      gap: 28px;
    }
    .total {
      font-size: 30px;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
    .debt {
      padding: 18px;
    }
    .avatar {
      width: 44px;
      height: 44px;
    }
    .amount {
      font-size: 24px;
    }
  }
</style>
