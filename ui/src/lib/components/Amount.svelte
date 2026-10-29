<script lang="ts">
  import { formatMoney, type Money, toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";

  export type Tone = "income" | "expense" | "transfer" | "neutral" | "auto";

  let {
    amount,
    code,
    symbol,
    decimals,
    tone = "auto",
    signed = false,
    approx = false,
    exact = false,
    class: className = "",
  }: Money & {
    tone?: Tone;
    signed?: boolean;
    approx?: boolean;
    exact?: boolean;
    class?: string;
  } = $props();

  const value = $derived(toNumber(amount));
  const converted = $derived(
    exact || !code || code === display.code
      ? null
      : display.convert(value, code)
  );
  const original = $derived(
    formatMoney({ amount, code, decimals, symbol }, signed)
  );
  const shown = $derived(
    converted === null
      ? original
      : formatMoney({ ...display.target, amount: converted }, signed)
  );
  const resolved = $derived.by(() => {
    if (tone !== "auto") {
      return tone;
    }
    if (value > 0) {
      return "income";
    }
    return value < 0 ? "expense" : "neutral";
  });
  const color = $derived(
    {
      expense: "text-expense",
      income: "text-income",
      neutral: "text-cladd-fg-softer",
      transfer: "text-transfer",
    }[resolved]
  );
</script>

<span
  class="num font-medium {color} {className}"
  title={converted === null ? undefined : original}
  >{approx || converted !== null ? "≈" : ""}{shown}</span
>
