<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { lists } from "#lib/api/lists.js";
  import { today } from "#lib/dates.js";
  import { goto } from "$app/navigation";
  import Seg from "../components/Seg.svelte";
  import Sheet from "../components/Sheet.svelte";
  import { forms } from "./forms.svelte.js";
  import { Saver, toAmount, validAmount } from "./saver.svelte.js";

  const saver = new Saver();
  const on = () => forms.newTx;
  const accounts = createQuery(() => ({ ...lists.accounts("all"), enabled: on() }));
  const categories = createQuery(() => ({ ...lists.categories(), enabled: on() }));

  let type = $state("withdrawal");
  let amount = $state("");
  let name = $state("");
  let date = $state(today());
  let mine = $state("");
  let other = $state("");
  let to = $state("");
  let category = $state("");
  let notes = $state("");

  const owned = $derived((accounts.data ?? []).filter((a) => a.attributes.active && ["asset", "liabilities", "liability"].includes(a.attributes.type)));
  const assets = $derived(owned.filter((a) => a.attributes.type === "asset"));
  const payees = $derived(
    (accounts.data ?? []).filter((a) => a.attributes.type === (type === "deposit" ? "revenue" : "expense")).map((a) => a.attributes.name)
  );

  $effect(() => {
    if (forms.newTx) {
      type = "withdrawal";
      amount = "";
      name = "";
      date = today();
      other = "";
      category = "";
      notes = "";
      saver.error = "";
    }
  });

  $effect(() => {
    if (forms.newTx && !mine && assets.length) {
      mine = assets[0].id;
      to = assets[1]?.id ?? assets[0].id;
    }
  });

  const TYPES = [
    { id: "withdrawal", label: "Expense" },
    { id: "deposit", label: "Income" },
    { id: "transfer", label: "Transfer" },
  ];

  async function save() {
    if (!validAmount(amount)) {
      saver.fail("How much?");
      return;
    }
    if (!name.trim()) {
      saver.fail("Give it a name");
      return;
    }
    const split: Record<string, unknown> = {
      amount: toAmount(amount),
      category_name: category.trim() || undefined,
      date,
      description: name.trim(),
      notes: notes || undefined,
      type,
    };
    if (type === "withdrawal") {
      Object.assign(split, { destination_name: other.trim() || name.trim(), source_id: mine });
    } else if (type === "deposit") {
      const debt = owned.find((a) => a.attributes.name === other.trim() && a.attributes.type !== "asset");
      Object.assign(split, debt ? { destination_id: mine, source_id: debt.id } : { destination_id: mine, source_name: other.trim() || name.trim() });
    } else {
      Object.assign(split, { destination_id: to, source_id: mine });
    }
    const made = await saver.run(() =>
      api<{ data: { id: string } }>("/v1/transactions", { body: { apply_rules: true, transactions: [split] }, method: "POST" })
    );
    if (made) {
      forms.newTx = false;
      goto(`/tx/${made.data.id}`);
    }
  }
</script>

<Sheet bind:open={forms.newTx} busy={saver.busy} error={saver.error} full="/transactions/create/{type}" onsubmit={save} submit="Add" title="New transaction">
  <Seg bind:value={type} options={TYPES} />
  <div class="pair">
    <label class="f">
      <span class="small">Amount</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input autofocus bind:value={amount} class="field amount" inputmode="decimal" placeholder="0,00" />
    </label>
    <label class="f">
      <span class="small">Date</span>
      <input bind:value={date} class="field amount" type="date" />
    </label>
  </div>
  <label class="f">
    <span class="small">Name</span>
    <input bind:value={name} class="field" placeholder={type === "deposit" ? "Salary" : "Groceries at Żabka"} />
  </label>
  <label class="f">
    <span class="small">{type === "deposit" ? "Into" : "From"}</span>
    <select bind:value={mine} class="field">
      {#each type === "transfer" ? assets : owned as a (a.id)}
        <option value={a.id}>{a.attributes.name} · {a.attributes.currency_code}</option>
      {/each}
    </select>
  </label>
  {#if type === "transfer"}
    <label class="f">
      <span class="small">To</span>
      <select bind:value={to} class="field">
        {#each assets as a (a.id)}<option value={a.id}>{a.attributes.name} · {a.attributes.currency_code}</option>{/each}
      </select>
    </label>
  {:else}
    <label class="f">
      <span class="small">{type === "deposit" ? "From who" : "Where"} <span class="hint">{type === "deposit" ? "type a debtor's name to mark a repayment" : "shop or person, defaults to the name"}</span></span>
      <input bind:value={other} class="field" list="tx-new-payees" />
      <datalist id="tx-new-payees">
        {#each payees as p (p)}<option value={p}></option>{/each}
        {#if type === "deposit"}{#each owned.filter((a) => a.attributes.type !== "asset") as a (a.id)}<option value={a.attributes.name}></option>{/each}{/if}
      </datalist>
    </label>
  {/if}
  {#if type !== "transfer"}
    <label class="f">
      <span class="small">Category</span>
      <input bind:value={category} class="field" list="tx-new-cats" placeholder="optional" />
      <datalist id="tx-new-cats">
        {#each categories.data ?? [] as c (c.id)}<option value={c.attributes.name}></option>{/each}
      </datalist>
    </label>
  {/if}
  <label class="f">
    <span class="small">Notes</span>
    <textarea bind:value={notes} class="field" rows="3"></textarea>
  </label>
</Sheet>
