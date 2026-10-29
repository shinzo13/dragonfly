<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { formatNumber } from "#lib/format.js";
  import { evalAmount, isExpression } from "./parse.js";
  import { INPUT } from "./styles.js";

  let {
    value = $bindable(""),
    ref = $bindable(null),
    currency = "",
    decimals = 2,
    invalid = false,
    class: className = "",
    ...rest
  }: Omit<HTMLInputAttributes, "value"> & {
    value?: string;
    ref?: HTMLInputElement | null;
    currency?: string;
    decimals?: number;
    invalid?: boolean;
  } = $props();

  const result = $derived(evalAmount(value));
  const preview = $derived(
    isExpression(value) && result !== null
      ? `= ${formatNumber(result, decimals)}`
      : ""
  );

  function normalise() {
    if (result !== null && result > 0) {
      value = result.toFixed(decimals);
    }
  }
</script>

<div class="relative {className}">
  <input
    bind:this={ref}
    {...rest}
    aria-invalid={invalid ||
      (value.trim() !== "" && result === null) ||
      undefined}
    autocomplete="off"
    class="{INPUT} num text-right {currency ? "pr-12" : ""}"
    inputmode="decimal"
    onblur={normalise}
    spellcheck="false"
    bind:value
  >
  {#if currency}
    <span
      class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[12px] text-cladd-fg-soft"
      >{currency}</span
    >
  {/if}
  {#if preview}
    <span
      class="num pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[12px] text-cladd-fg-soft"
      >{preview}</span
    >
  {/if}
</div>
