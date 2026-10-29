<script lang="ts">
  import { untrack } from "svelte";
  import { ApiError } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Range } from "#lib/dates.js";
  import { formatMoney } from "#lib/format.js";
  import { type Line, lineMoney, parseAmount, saveLimit } from "./data.js";

  export type Move = 0 | 1 | -1;

  let {
    line,
    budgetId,
    range,
    editing,
    suggested = null,
    trap = true,
    onedit,
    ondone,
  }: {
    line: Line;
    budgetId: string;
    range: Range;
    editing: boolean;
    suggested?: number | null;
    trap?: boolean;
    onedit: () => void;
    ondone: (move: Move) => void;
  } = $props();

  let value = $state("");
  let busy = $state(false);
  let problem = $state("");

  $effect(() => {
    if (editing) {
      untrack(() => {
        value = String(line.amount || suggested || "");
        problem = "";
      });
    }
  });

  function focus(input: HTMLInputElement) {
    input.focus();
    input.select();
  }

  function message(failure: unknown) {
    if (failure instanceof ApiError) {
      return Object.values(failure.errors).flat()[0] ?? failure.message;
    }
    return failure instanceof Error ? failure.message : String(failure);
  }

  async function commit(move: Move) {
    if (busy) {
      return;
    }
    const amount = parseAmount(value);
    if (amount === null) {
      problem = "Type a positive number";
      return;
    }
    if (amount === (line.amount ?? 0)) {
      ondone(move);
      return;
    }
    busy = true;
    problem = "";
    try {
      await saveLimit(budgetId, line, amount, range);
      await invalidate();
      ondone(move);
    } catch (failure) {
      problem = message(failure);
    } finally {
      busy = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(0);
    } else if (event.key === "Tab" && trap) {
      event.preventDefault();
      commit(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      ondone(0);
    }
  }

  function onblur(event: FocusEvent) {
    const next = event.relatedTarget;
    if (
      !editing ||
      busy ||
      (next instanceof Element && next.closest("[data-limit-editor]"))
    ) {
      return;
    }
    const amount = parseAmount(value);
    if (amount === (line.amount ?? 0)) {
      ondone(0);
    } else {
      commit(0);
    }
  }
</script>

{#if editing}
  <span class="inline-flex items-center gap-1">
    <span class="num text-cladd-fg-softer">{line.cur.symbol}</span>
    <input
      aria-label="Budgeted amount in {line.cur.code}"
      class="num cladd-cut cladd-focusable-input h-6 w-28 rounded-cladd-sm px-1.5 text-right text-[13px] text-cladd-fg"
      disabled={busy}
      inputmode="decimal"
      {onblur}
      {onkeydown}
      placeholder="0"
      bind:value
      {@attach focus}
    >
  </span>
{:else if suggested && line.amount === null}
  <button
    class="num border-brand border-b border-dashed font-semibold leading-tight text-brand"
    onclick={onedit}
    title="Suggested from the last 3 months (e to change)"
    type="button"
  >
    <span class="font-normal text-[11px]">suggested</span>
    {formatMoney({
      amount: suggested,
      decimals: line.cur.decimals,
      symbol: line.cur.symbol,
    })}
  </button>
{:else}
  <button
    class="num border-cladd-fg-softest border-b border-dashed leading-tight hover:border-brand hover:text-brand {line.amount
      ? "text-cladd-fg"
      : "text-cladd-fg-softer"}"
    onclick={onedit}
    title="Set the budgeted amount (e)"
    type="button"
  >
    {line.amount
      ? lineMoney(line, line.amount)
      : `${line.cur.symbol} set amount`}
  </button>
{/if}
{#if busy}
  <span class="text-[11px] text-cladd-fg-soft">Saving</span>
{:else if problem}
  <span class="text-[11px] text-expense">{problem}</span>
{/if}
