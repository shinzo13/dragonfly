<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import { period } from "#lib/period.svelte.js";
  import AccountCard from "#lib/v2/components/AccountCard.svelte";
  import AccountForm from "#lib/v2/forms/AccountForm.svelte";
  import { q } from "#lib/v2/data.js";
  import { hidden } from "#lib/v2/hidden.svelte.js";
  import { view } from "#lib/v2/money.svelte.js";
  import { worth } from "#lib/v2/stats.js";

  let archived = $state(false);
  let creating = $state(false);
  let hiding = $state(false);

  const accounts = createQuery(() => q.accounts("asset", period.end));

  const active = $derived((accounts.data ?? []).filter((a) => a.attributes.active));
  const inactive = $derived((accounts.data ?? []).filter((a) => !a.attributes.active));
  const visible = $derived(active.filter((a) => !hidden.has(a.id)));
  const shown = $derived(archived ? inactive : hiding ? active : visible);
  const total = $derived(view.ready ? worth(accounts.data) : 0);
</script>

<svelte:head><title>Accounts · Dragonfly</title></svelte:head>

<div class="head">
  <div>
    <div class="small label">{archived ? `${inactive.length} archived` : `${visible.length} accounts`}</div>
    {#if accounts.isPending || !view.ready}
      <div class="skeleton" style="width: 260px; height: 44px; margin-top: 6px"></div>
    {:else}
      <div class="big total">{view.show(total)}</div>
    {/if}
  </div>
  <div class="actions">
    {#if !archived}
      <button class="btn" class:on={hiding} onclick={() => (hiding = !hiding)} type="button"><EyeOff size={15} />{hiding ? "Done" : active.length > visible.length ? `Hidden · ${active.length - visible.length}` : "Hide accounts"}</button>
    {/if}
    {#if inactive.length && !hiding}
      <button class="btn" class:on={archived} onclick={() => (archived = !archived)}><Archive size={15} />{archived ? "Active" : `Archived · ${inactive.length}`}</button>
    {/if}
    <button class="btn primary" onclick={() => (creating = true)} type="button"><Plus size={15} />New account</button>
  </div>
</div>

<div class="grid">
  {#if accounts.isPending}
    {#each [0, 1, 2] as i (i)}<div class="skeleton" style="height: 220px; border-radius: 22px"></div>{/each}
  {:else}
    {#each shown as a (a.id)}
      {@const off = hidden.has(a.id)}
      <div class="slot" class:off={hiding && off}>
        <AccountCard account={a.attributes} href={hiding ? undefined : `/acc/${a.id}`} id={a.id} />
        {#if hiding}
          <button aria-label="{off ? 'Show' : 'Hide'} {a.attributes.name}" aria-pressed={off} class="eye" onclick={() => hidden.toggle(a.id)} type="button">
            <span>{#if off}<EyeOff size={17} />{:else}<Eye size={17} />{/if}</span>
          </button>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<AccountForm bind:open={creating} kind="asset" />

<style>
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .label {
    font-size: 14px;
  }
  .total {
    font-size: 40px;
    margin-top: 4px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 22px;
  }
  .slot {
    position: relative;
    min-width: 0;
  }
  .slot :global(.card) {
    transition: opacity 0.18s, filter 0.18s;
  }
  .slot.off :global(.card) {
    opacity: 0.35;
    filter: grayscale(0.7);
  }
  .eye {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 18px;
    border: 0;
    border-radius: 22px;
    background: none;
    color: #fff;
    cursor: pointer;
  }
  .eye span {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.45);
  }
  @media (max-width: 760px) {
    .actions {
      flex-wrap: wrap;
    }
    .head {
      flex-direction: column;
      align-items: stretch;
      gap: 14px;
      margin-bottom: 16px;
    }
    .total {
      font-size: 34px;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .grid :global(.card) {
      height: 150px !important;
    }
  }
</style>
