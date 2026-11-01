<script lang="ts">
  import { api } from "#lib/api/client.js";
  import type { BudgetLimit, Item } from "#lib/api/types.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import Sheet from "../components/Sheet.svelte";
  import type { BudgetX } from "../data.js";
  import { primaryCode } from "../money.svelte.js";
  import { currencies, Saver, toAmount, validAmount } from "./saver.svelte.js";

  let {
    open = $bindable(false),
    budget,
    limit,
  }: { open?: boolean; budget?: Item<BudgetX>; limit?: Item<BudgetLimit> } = $props();

  const saver = new Saver();
  let name = $state("");
  let amount = $state("");
  let currency = $state("");
  let archived = $state(false);

  $effect(() => {
    if (!open) {
      return;
    }
    const b = budget?.attributes;
    name = b?.name ?? "";
    amount = limit?.attributes.amount ?? b?.auto_budget_amount ?? "";
    currency = limit?.attributes.currency_code ?? b?.currency_code ?? primaryCode();
    archived = b ? !b.active : false;
    saver.error = "";
  });

  async function save() {
    if (!name.trim()) {
      saver.fail("Give it a name");
      return;
    }
    const hasLimit = validAmount(amount);
    const body = {
      active: !archived,
      auto_budget_amount: hasLimit ? toAmount(amount) : undefined,
      auto_budget_currency_code: currency,
      auto_budget_period: "monthly",
      auto_budget_type: hasLimit ? "reset" : "none",
      name: name.trim(),
    };
    const ok = await saver.run(async () => {
      const saved = await api<{ data: { id: string } }>(budget ? `/v1/budgets/${budget.id}` : "/v1/budgets", {
        body,
        method: budget ? "PUT" : "POST",
      });
      if (!hasLimit) {
        return true;
      }
      if (limit) {
        await api(`/v1/budgets/${saved.data.id}/limits/${limit.id}`, { body: { amount: toAmount(amount) }, method: "PUT" });
      } else {
        await api(`/v1/budgets/${saved.data.id}/limits`, {
          body: { amount: toAmount(amount), currency_code: currency, end: period.end, start: period.start },
          method: "POST",
        }).catch(() => undefined);
      }
      return true;
    });
    if (ok) {
      open = false;
    }
  }
</script>

<Sheet
  bind:open
  busy={saver.busy}
  error={saver.error}
  full={budget ? `/budgets/edit/${budget.id}` : "/budgets/create"}
  onsubmit={save}
  submit={budget ? "Save" : "Create"}
  title={budget ? `Edit ${budget.attributes.name}` : "New budget"}
>
  <label class="f">
    <span class="small">Name</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input autofocus bind:value={name} class="field" placeholder="Food" />
  </label>
  <div class="pair">
    <label class="f">
      <span class="small">Monthly limit</span>
      <input bind:value={amount} class="field amount" inputmode="decimal" placeholder="800" />
    </label>
    <label class="f">
      <span class="small">Currency</span>
      <select bind:value={currency} class="field amount">
        {#each currencies(session.currencies) as c (c.code)}<option value={c.code}>{c.code}</option>{/each}
      </select>
    </label>
  </div>
  <span class="small hint">Resets every month. Leave empty for a budget without a limit.</span>
  {#if budget}
    <label class="check"><input bind:checked={archived} type="checkbox" />Archived</label>
  {/if}
</Sheet>
