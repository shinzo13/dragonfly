<script lang="ts">
  import { api } from "#lib/api/client.js";
  import type { Item } from "#lib/api/types.js";
  import { toNumber } from "#lib/format.js";
  import Seg from "../components/Seg.svelte";
  import Sheet from "../components/Sheet.svelte";
  import type { PiggyX } from "../data.js";
  import { money } from "../money.svelte.js";
  import { Saver, toAmount, validAmount } from "./saver.svelte.js";

  let {
    open = $bindable(false),
    piggy,
    mode = $bindable("add"),
  }: { open?: boolean; piggy: Item<PiggyX>; mode?: string } = $props();

  const saver = new Saver();
  let amount = $state("");

  $effect(() => {
    if (open) {
      amount = "";
      saver.error = "";
    }
  });

  const slot = $derived(piggy.attributes.accounts?.[0]);
  const current = $derived(toNumber(slot?.current_amount));
  const code = $derived(piggy.attributes.currency_code ?? "");
  const left = $derived(Math.max(0, toNumber(piggy.attributes.target_amount) - current));

  async function save() {
    if (!slot || !validAmount(amount)) {
      saver.fail("How much?");
      return;
    }
    const delta = Number(toAmount(amount)) * (mode === "add" ? 1 : -1);
    const next = current + delta;
    if (next < 0) {
      saver.fail(`There is only ${money(current, code)} inside`);
      return;
    }
    const ok = await saver.run(() =>
      api(`/v1/piggy-banks/${piggy.id}`, {
        body: { accounts: [{ account_id: slot.account_id, current_amount: next.toFixed(2) }] },
        method: "PUT",
      })
    );
    if (ok !== undefined) {
      open = false;
    }
  }
</script>

<Sheet bind:open busy={saver.busy} error={saver.error} full="/piggy-banks/show/{piggy.id}" onsubmit={save} submit={mode === "add" ? "Put in" : "Take out"} title={piggy.attributes.name}>
  <Seg bind:value={mode} options={[{ id: "add", label: "Put in" }, { id: "remove", label: "Take out" }]} />
  <label class="f">
    <span class="small">Amount, {code}</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input autofocus bind:value={amount} class="field amount" inputmode="decimal" placeholder={mode === "add" ? money(left, code, { decimals: 0 }) : money(current, code, { decimals: 0 })} />
  </label>
  <span class="small hint">Inside now: {money(current, code)}{slot ? ` · kept in ${slot.name}` : ""}</span>
</Sheet>
