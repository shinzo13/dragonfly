<script lang="ts">
  import { api } from "#lib/api/client.js";
  import type { Item } from "#lib/api/types.js";
  import { today } from "#lib/dates.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";
  import Seg from "../components/Seg.svelte";
  import Sheet from "../components/Sheet.svelte";
  import type { AccountX } from "../data.js";
  import { primaryCode } from "../money.svelte.js";
  import { currencies, Saver, toAmount } from "./saver.svelte.js";

  let {
    open = $bindable(false),
    kind,
    account,
  }: { open?: boolean; kind: "asset" | "debt"; account?: Item<AccountX> } = $props();

  const saver = new Saver();
  let name = $state("");
  let role = $state("defaultAsset");
  let direction = $state("credit");
  let currency = $state("");
  let amount = $state("");
  let since = $state(today());
  let inTotal = $state(true);
  let archived = $state(false);

  $effect(() => {
    if (!open) {
      return;
    }
    const a = account?.attributes;
    name = a?.name ?? "";
    role = a?.account_role ?? "defaultAsset";
    direction = a?.liability_direction ?? "credit";
    currency = a?.currency_code ?? primaryCode();
    amount = "";
    since = today();
    inTotal = a?.include_net_worth ?? true;
    archived = a ? !a.active : false;
    saver.error = "";
  });

  const ROLES = [
    { id: "defaultAsset", label: "Account" },
    { id: "savingAsset", label: "Savings" },
    { id: "cashWalletAsset", label: "Cash" },
  ];
  const DIRECTIONS = [
    { id: "credit", label: "They owe me" },
    { id: "debit", label: "I owe them" },
  ];

  const editing = $derived(Boolean(account));
  const full = $derived(account ? `/accounts/edit/${account.id}` : `/accounts/create/${kind === "debt" ? "liabilities" : "asset"}`);
  const title = $derived(editing ? `Edit ${account?.attributes.name}` : kind === "debt" ? "New debt" : "New account");

  async function save() {
    if (!name.trim()) {
      saver.fail(kind === "debt" ? "Who is it?" : "Give it a name");
      return;
    }
    const body: Record<string, unknown> = { name: name.trim() };
    if (kind === "asset") {
      Object.assign(body, { account_role: role, include_net_worth: inTotal });
    } else {
      body.liability_direction = direction;
    }
    if (editing && account) {
      body.active = !archived;
      if (kind === "debt") {
        Object.assign(body, { liability_type: "debt" });
      }
      const ok = await saver.run(() => api(`/v1/accounts/${account.id}`, { body, method: "PUT" }));
      if (ok !== undefined) {
        open = false;
      }
      return;
    }
    Object.assign(body, { currency_code: currency, type: kind === "debt" ? "liabilities" : "asset" });
    if (kind === "debt") {
      Object.assign(body, { liability_type: "debt", ...(amount && { liability_amount: toAmount(amount), liability_start_date: since }) });
    } else if (amount) {
      Object.assign(body, { opening_balance: toAmount(amount), opening_balance_date: since });
    }
    const made = await saver.run(() => api<{ data: { id: string } }>("/v1/accounts", { body, method: "POST" }));
    if (made) {
      open = false;
      goto(`/acc/${made.data.id}${kind === "debt" ? "?from=debts" : ""}`);
    }
  }
</script>

<Sheet bind:open busy={saver.busy} error={saver.error} {full} onsubmit={save} submit={editing ? "Save" : "Create"} {title}>
  <label class="f">
    <span class="small">{kind === "debt" ? "Person" : "Name"}</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input autofocus bind:value={name} class="field" placeholder={kind === "debt" ? "Alex Doe" : "Erste"} />
  </label>
  {#if kind === "asset"}
    <div class="f"><span class="small">Kind</span><Seg bind:value={role} options={ROLES} /></div>
  {:else}
    <div class="f"><span class="small">Direction</span><Seg bind:value={direction} options={DIRECTIONS} /></div>
  {/if}
  {#if !editing}
    <label class="f">
      <span class="small">Currency</span>
      <select bind:value={currency} class="field">
        {#each currencies(session.currencies) as c (c.code)}<option value={c.code}>{c.code} · {c.name}</option>{/each}
      </select>
    </label>
    <div class="pair">
      <label class="f">
        <span class="small">{kind === "debt" ? "Amount" : "Balance now"}</span>
        <input bind:value={amount} class="field" inputmode="decimal" placeholder="0,00" />
      </label>
      <label class="f">
        <span class="small">{kind === "debt" ? "Since" : "As of"}</span>
        <input bind:value={since} class="field" type="date" />
      </label>
    </div>
  {/if}
  {#if kind === "asset"}
    <label class="check"><input bind:checked={inTotal} type="checkbox" />Count in total balance</label>
  {/if}
  {#if editing}
    <label class="check"><input bind:checked={archived} type="checkbox" />{kind === "debt" ? "Settled, hide it" : "Archived"}</label>
  {/if}
</Sheet>
