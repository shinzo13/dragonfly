<script lang="ts">
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, PiggyBank } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import { evalAmount } from "#lib/components/inputs/parse.js";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import Status from "#lib/components/misc/Status.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { formatMoney } from "#lib/format.js";
  import {
    changeMoney,
    limit,
    type Mode,
    piggyMoney,
    type Room,
  } from "./piggy.js";

  let {
    piggy,
    mode,
    rooms,
    onclose,
  }: {
    piggy: Item<PiggyBank>;
    mode: Mode;
    rooms: Map<string, Room>;
    onclose: () => void;
  } = $props();

  const action = new Action();
  const values = $state<Record<string, string>>({});
  const fields: Record<string, HTMLElement> = {};

  const links = $derived(
    (piggy.attributes.accounts ?? []).map((link) => {
      const id = link.account_id ?? "";
      return {
        id,
        max: limit(piggy.attributes, id, mode, rooms.get(id)),
        name: link.name ?? id,
      };
    })
  );
  const open = $derived(links.filter((l) => l.max > 0));

  function onEscape(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onclose();
    }
  }

  function fail(message: string, id = open[0]?.id ?? "") {
    action.failed = true;
    action.message = message;
    fields[id]?.focus();
  }

  async function save() {
    const deltas: Record<string, number> = {};
    for (const link of open) {
      const raw = values[link.id]?.trim();
      if (!raw) {
        continue;
      }
      const amount = evalAmount(raw);
      if (amount === null || amount <= 0) {
        return fail("Enter an amount above zero", link.id);
      }
      if (amount > link.max + 1e-9) {
        const max = formatMoney(piggyMoney(piggy.attributes, link.max));
        return fail(`${link.name} allows at most ${max}`, link.id);
      }
      deltas[link.id] = mode === "add" ? amount : -amount;
    }
    if (Object.keys(deltas).length === 0) {
      return fail("Enter an amount");
    }
    const ok = await action.run(
      () => changeMoney(piggy, deltas),
      mode === "add" ? "Added" : "Removed"
    );
    if (ok) {
      await invalidate();
      onclose();
    }
  }
</script>

<form
  class="flex flex-wrap items-center gap-x-4 gap-y-2"
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <span class="font-semibold">
    {mode === "add" ? "Add money to" : "Remove money from"}
    {piggy.attributes.name}
  </span>
  {#each open as link, i (link.id)}
    <div class="flex items-center gap-2">
      {#if open.length > 1}
        <span>{link.name}</span>
      {/if}
      <Input
        aria-label="Amount for {link.name}"
        class="num h-7 w-28"
        inputmode="decimal"
        onkeydown={onEscape}
        bind:value={values[link.id]}
        {@attach (node) => {
          fields[link.id] = node;
          if (i === 0) {
            node.focus();
          }
        }}
      />
      <span class="text-[12px] text-cladd-fg-soft">
        up to
        <Amount
          {...piggyMoney(piggy.attributes, link.max)}
          exact
          tone="neutral"
        />
      </span>
    </div>
  {:else}
    <span class="text-cladd-fg-soft">
      {mode === "add"
        ? "You have no money to put in this piggy bank."
        : "There is no money in this piggy bank."}
    </span>
  {/each}
  {#if open.length > 0}
    <Button disabled={action.busy} size="sm" type="submit">
      {mode === "add" ? "Add" : "Remove"}
    </Button>
  {/if}
  <Button onclick={onclose} size="sm" type="button" variant="ghost"
    >Cancel <span class="kbd">Esc</span></Button
  >
  <Status {action} />
</form>
