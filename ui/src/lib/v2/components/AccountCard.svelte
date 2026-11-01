<script lang="ts">
  import type { AccountX } from "../data.js";
  import { look } from "../look.svelte.js";
  import { money, view } from "../money.svelte.js";
  import { balanceOf } from "../stats.js";
  import Glyph from "./Glyph.svelte";

  let {
    id,
    account,
    href,
    height = 220,
  }: { id: string; account: AccountX; href?: string; height?: number } = $props();

  const ROLE: Record<string, string> = {
    cashWalletAsset: "Cash",
    ccAsset: "Credit card",
    defaultAsset: "Account",
    savingAsset: "Savings",
    sharedAsset: "Shared",
  };

  const l = $derived(look.of("account", id, account.name, account.account_role ?? undefined));
  const value = $derived(balanceOf(account));
  const kind = $derived(account.type === "asset" ? (ROLE[account.account_role ?? ""] ?? "Account") : "Debt");
  const custom = $derived(l.icon.startsWith("svg:"));
</script>

<svelte:element this={href ? "a" : "div"} class="card" class:clickable={href} {href} style:--c={l.color} style:height="{height}px">
  <span class="orb orb-a"></span>
  <span class="orb orb-b"></span>
  <div class="head">
    <span class="icon" class:custom><Glyph name={l.icon} size={custom ? 28 : 21} /></span>
    <div class="name">
      <div class="title">{account.name}</div>
      <div class="kind">{kind}{account.active ? "" : " · archived"}</div>
    </div>
    <span class="delta">{account.currency_code}</span>
  </div>
  <div class="sum">
    <div class="value" data-copy>{view.each(value, Number(account.current_balance ?? 0), account.currency_code)}</div>
    <div class="orig" data-copy>
      {#if view.foreign(account.currency_code)}{money(Number(account.current_balance ?? 0), account.currency_code ?? "")}{/if}
    </div>
  </div>
</svelte:element>

<style>
  .card {
    border-radius: 22px;
    padding: 22px 24px;
    background: var(--c);
    color: #fff;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: var(--card-shadow), inset 0 0 0 1px var(--card-edge);
    transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.18s;
  }
  .clickable:hover {
    transform: translateY(-3px);
  }
  .orb {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }
  .orb-a {
    right: -70px;
    top: -70px;
    width: 240px;
    height: 240px;
    background: #ffffff12;
  }
  .orb-b {
    right: 40px;
    bottom: -120px;
    width: 220px;
    height: 220px;
    background: #ffffff0c;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
  }
  .icon {
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: #ffffff26;
    display: grid;
    place-items: center;
    flex: none;
  }
  .icon.custom {
    background: #fff;
  }
  .name {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 16px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    font-size: 12px;
    font-weight: 600;
    opacity: 0.75;
  }
  .delta {
    font-size: 12px;
    font-weight: 800;
    background: #ffffff22;
    padding: 5px 9px;
    border-radius: 8px;
    white-space: nowrap;
  }
  .sum {
    position: relative;
  }
  .value {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.035em;
    line-height: 1.05;
  }
  .orig {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.75;
    margin-top: 6px;
    min-height: 18px;
  }
  @media (max-width: 760px) {
    .card {
      padding: 18px 20px;
    }
    .value {
      font-size: 30px;
    }
  }
</style>
