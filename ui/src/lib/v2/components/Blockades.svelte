<script lang="ts">
  import { look } from "../look.svelte.js";
  import { view } from "../money.svelte.js";
  import { rowValue } from "../stats.js";
  import type { Row } from "../tx.js";
  import Chip from "./Chip.svelte";

  let { rows }: { rows: Row[] } = $props();

  const total = $derived(rows.reduce((s, row) => s + rowValue(row), 0));
  const accounts = $derived.by(() => {
    const map = new Map<string, { id: string; name: string; value: number }>();
    for (const row of rows) {
      const entry = map.get(row.accountId) ?? { id: row.accountId, name: row.account, value: 0 };
      entry.value += rowValue(row);
      map.set(row.accountId, entry);
    }
    return [...map.values()];
  });
</script>

{#if rows.length}
  <section class="panel blockades">
    <div class="line">
      <span class="small">Blockades</span>
      <span class="sum" data-copy>{view.show(total)}</span>
    </div>
    {#if accounts.length > 1}
      <div class="accounts">
        {#each accounts as account (account.id)}
          {@const l = look.of("account", account.id, account.name)}
          <div class="account">
            <Chip color={l.color} icon={l.icon} radius={7} size={24} />
            <span class="name">{account.name}</span>
            <span class="muted" data-copy>{view.show(account.value)}</span>
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
