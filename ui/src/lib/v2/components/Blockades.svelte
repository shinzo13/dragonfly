<script lang="ts">
  import { look } from "../look.svelte.js";
  import { view } from "../money.svelte.js";
  import { rowValue } from "../stats.js";
  import type { Row } from "../tx.js";
  import Chip from "./Chip.svelte";

  let { rows }: { rows: Row[] } = $props();

  const total = $derived(rows.reduce((s, row) => s + rowValue(row), 0));
</script>

{#if rows.length}
  <section class="panel blockades">
    <div class="line">
      <span class="small">Blockades</span>
      <span class="sum" data-copy>{view.show(total)}</span>
    </div>
    {#if rows.length > 1}
      <div class="accounts">
        {#each rows as row (row.id)}
          {@const l = look.of("account", row.accountId, row.account)}
          <div class="account">
            <Chip color={l.color} icon={l.icon} radius={7} size={24} />
            <span class="name">{row.account}</span>
            <span class="muted" data-copy>{view.show(rowValue(row))}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>
{/if}

<style>
  .line {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sum {
    font-size: 22px;
    font-weight: 800;
  }
  .accounts {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }
  .account {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 700;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 760px) {
    .line {
      flex-direction: row;
      align-items: baseline;
      justify-content: space-between;
    }
    .sum {
      font-size: 16px;
    }
    .accounts {
      display: none;
    }
  }
</style>
