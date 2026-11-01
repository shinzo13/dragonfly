<script lang="ts">
  import { api } from "#lib/api/client.js";
  import type { Item } from "#lib/api/types.js";
  import { today } from "#lib/dates.js";
  import { session } from "#lib/session.svelte.js";
  import Chip from "../components/Chip.svelte";
  import LookPicker from "../components/LookPicker.svelte";
  import Seg from "../components/Seg.svelte";
  import Sheet from "../components/Sheet.svelte";
  import type { BillX } from "../data.js";
  import { look } from "../look.svelte.js";
  import { primaryCode } from "../money.svelte.js";
  import { currencies, Saver, toAmount, validAmount } from "./saver.svelte.js";

  let { open = $bindable(false), bill }: { open?: boolean; bill?: Item<BillX> } = $props();

  const saver = new Saver();
  let name = $state("");
  let amount = $state("");
  let max = $state("");
  let currency = $state("");
  let date = $state(today());
  let repeat = $state("monthly");
  let paused = $state(false);
  let picking = $state(false);
  const l = $derived(bill ? look.of("bill", bill.id, bill.attributes.name ?? "") : null);

  $effect(() => {
    if (!open) {
      return;
    }
    const b = bill?.attributes;
    name = b?.name ?? "";
    amount = b?.amount_min ?? "";
    max = b && b.amount_max !== b.amount_min ? (b.amount_max ?? "") : "";
    currency = b?.currency_code ?? primaryCode();
    date = (b?.next_expected_match ?? b?.pay_dates?.[0] ?? b?.date ?? today()).slice(0, 10);
    repeat = b?.repeat_freq ?? "monthly";
    paused = b ? !b.active : false;
    saver.error = "";
  });

  const REPEAT = [
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "quarterly", label: "Quarterly" },
    { id: "yearly", label: "Yearly" },
  ];

  async function save() {
    if (!name.trim()) {
      saver.fail("Give it a name");
      return;
    }
    if (!validAmount(amount)) {
      saver.fail("How much is it?");
      return;
    }
    const low = toAmount(amount);
    const high = validAmount(max) ? toAmount(max) : low;
    const body = {
      active: !paused,
      amount_max: Number(high) < Number(low) ? low : high,
      amount_min: low,
      currency_code: currency,
      date,
      name: name.trim(),
      repeat_freq: repeat,
    };
    const ok = await saver.run(() => api(bill ? `/v1/bills/${bill.id}` : "/v1/bills", { body, method: bill ? "PUT" : "POST" }));
    if (ok !== undefined) {
      open = false;
    }
  }
</script>

<Sheet
  bind:open
  busy={saver.busy}
  error={saver.error}
  full={bill ? `/subscriptions/edit/${bill.id}` : "/subscriptions/create"}
  onsubmit={save}
  submit={bill ? "Save" : "Create"}
  title={bill ? `Edit ${bill.attributes.name}` : "New subscription"}
>
  <div class="named">
    {#if l}
      <button aria-label="Change icon and colour" class="look" onclick={() => (picking = true)} title="Change icon and colour" type="button">
        <Chip color={l.color} icon={l.icon} size={44} />
      </button>
    {/if}
    <label class="f">
      <span class="small">Name</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input autofocus bind:value={name} class="field" placeholder="Claude" />
    </label>
  </div>
  <div class="pair">
    <label class="f">
      <span class="small">Amount</span>
      <input bind:value={amount} class="field amount" inputmode="decimal" placeholder="20" />
    </label>
    <label class="f">
      <span class="small">Currency</span>
      <select bind:value={currency} class="field amount">
        {#each currencies(session.currencies) as c (c.code)}<option value={c.code}>{c.code}</option>{/each}
      </select>
    </label>
  </div>
  <label class="f">
    <span class="small">Up to · <span class="hint">if the price floats</span></span>
    <input bind:value={max} class="field" inputmode="decimal" placeholder="optional" />
  </label>
  <div class="f"><span class="small">Repeats</span><Seg bind:value={repeat} options={REPEAT} /></div>
  <label class="f">
    <span class="small">Next payment</span>
    <input bind:value={date} class="field" type="date" />
  </label>
  {#if bill}
    <label class="check"><input bind:checked={paused} type="checkbox" />Paused</label>
  {/if}
</Sheet>
{#if bill}
  <LookPicker bind:open={picking} id={bill.id} kind="bill" name={bill.attributes.name ?? ""} />
{/if}

<style>
  .named {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  .named .f {
    flex: 1;
  }
  .look {
    border: 0;
    padding: 0;
    background: none;
    border-radius: 14px;
    cursor: pointer;
  }
</style>
