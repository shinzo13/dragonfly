<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { lists } from "#lib/api/lists.js";
  import type { Item } from "#lib/api/types.js";
  import { today } from "#lib/dates.js";
  import Sheet from "../components/Sheet.svelte";
  import type { PiggyX } from "../data.js";
  import { Saver, toAmount, validAmount } from "./saver.svelte.js";

  let { open = $bindable(false), piggy }: { open?: boolean; piggy?: Item<PiggyX> } = $props();

  const saver = new Saver();
  const accounts = createQuery(() => ({ ...lists.accounts("asset"), enabled: open }));
  let name = $state("");
  let target = $state("");
  let account = $state("");
  let by = $state("");

  $effect(() => {
    if (!open) {
      return;
    }
    const p = piggy?.attributes;
    name = p?.name ?? "";
    target = p?.target_amount ?? "";
    account = p?.accounts?.[0]?.account_id ?? "";
    by = p?.target_date?.slice(0, 10) ?? "";
    saver.error = "";
  });

  $effect(() => {
    if (open && !account && accounts.data?.length) {
      account = accounts.data.find((a) => a.attributes.active)?.id ?? "";
    }
  });

  async function save() {
    if (!name.trim()) {
      saver.fail("Give it a name");
      return;
    }
    if (!validAmount(target)) {
      saver.fail("How much do you want to save?");
      return;
    }
    const chosen = accounts.data?.find((a) => a.id === account);
    const body = {
      name: name.trim(),
      target_amount: toAmount(target),
      target_date: by || null,
      ...(!piggy && {
        accounts: [{ account_id: account }],
        start_date: today(),
        transaction_currency_code: chosen?.attributes.currency_code,
      }),
    };
    const ok = await saver.run(() => api(piggy ? `/v1/piggy-banks/${piggy.id}` : "/v1/piggy-banks", { body, method: piggy ? "PUT" : "POST" }));
    if (ok !== undefined) {
      open = false;
    }
  }
</script>

<Sheet
  bind:open
  busy={saver.busy}
  error={saver.error}
  full={piggy ? `/piggy-banks/edit/${piggy.id}` : "/piggy-banks/create"}
  onsubmit={save}
  submit={piggy ? "Save" : "Create"}
  title={piggy ? `Edit ${piggy.attributes.name}` : "New piggy bank"}
>
  <label class="f">
    <span class="small">Name</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input autofocus bind:value={name} class="field" placeholder="New laptop" />
  </label>
  <label class="f">
    <span class="small">Goal</span>
    <input bind:value={target} class="field amount" inputmode="decimal" placeholder="1200" />
  </label>
  {#if !piggy}
    <label class="f">
      <span class="small">Kept in</span>
      <select bind:value={account} class="field">
        {#each (accounts.data ?? []).filter((a) => a.attributes.active) as a (a.id)}
          <option value={a.id}>{a.attributes.name} · {a.attributes.currency_code}</option>
        {/each}
      </select>
    </label>
  {/if}
  <label class="f">
    <span class="small">By <span class="hint">optional</span></span>
    <input bind:value={by} class="field" type="date" />
  </label>
</Sheet>
