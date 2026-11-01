<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { view } from "../money.svelte.js";

  let { data }: { data: { id: string; name: string; count: number; value: number }[] } = $props();
  const max = $derived(data[0]?.value ?? 1);
</script>

<div class="head small"><span>Place</span><span>Visits</span><span>Total · avg</span><span></span></div>
<div class="list">
  {#each data as p, i (p.name)}
    <a class="row" href="/tx?account={p.id}&type=withdrawal">
      <span class="name"><span class="rank">{i + 1}</span>{p.name}</span>
      <span class="muted">{p.count}×</span>
      <span class="total">
        <span><b>{view.show(p.value, { decimals: 0 })}</b>{#if p.count > 1}<span class="avg"> · {view.show(p.value / p.count, { decimals: 0 })}</span>{/if}</span>
        <span class="bar"><i style:width="{(p.value / max) * 100}%"></i></span>
      </span>
      <ChevronRight class="go" size={15} />
    </a>
  {/each}
</div>

<style>
  .head,
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 44px 130px 15px;
    gap: 10px;
    align-items: center;
    gap: 12px;
  }
  .head {
    padding: 0 10px 8px;
    font-size: 11.5px;
  }
  .head span:not(:first-child),
  .row > span:not(.name) {
    text-align: right;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 -0px;
  }
  .row {
    padding: 8px 10px;
    border-radius: 11px;
    font-size: 14px;
    font-weight: 700;
  }
  .row:hover {
    background: var(--hover);
  }
  .name {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .rank {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    background: var(--sunk);
    display: grid;
    place-items: center;
    font-size: 11.5px;
    color: var(--mute);
    flex: none;
  }
  .total {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .avg {
    color: var(--mute);
    font-weight: 600;
    font-size: 12.5px;
  }
  .bar {
    width: 100%;
    height: 4px;
    border-radius: 3px;
    background: var(--track);
    overflow: hidden;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--acc);
    border-radius: 3px;
    margin-left: auto;
  }
  .row :global(.go) {
    color: var(--faint);
    opacity: 0;
  }
  .row:hover :global(.go) {
    opacity: 1;
  }
</style>
