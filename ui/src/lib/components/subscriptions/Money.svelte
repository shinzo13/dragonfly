<script lang="ts">
  import { formatNumber, toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";

  let {
    amount,
    code,
    symbol,
    decimals,
    approx = false,
    converted = false,
    exact = false,
    class: className = "",
  }: {
    amount: number | string | null | undefined;
    code?: string | null;
    symbol?: string | null;
    decimals?: number | null;
    approx?: boolean;
    converted?: boolean;
    exact?: boolean;
    class?: string;
  } = $props();

  const value = $derived(Math.abs(toNumber(amount)));
  const into = $derived(
    exact || !code || code === display.code
      ? null
      : display.convert(value, code)
  );
  const shown = $derived(
    into === null
      ? { amount: value, decimals, symbol }
      : { ...display.target, amount: into }
  );
  const mark = $derived.by(() => {
    if (converted || into !== null) {
      return "≈";
    }
    return approx ? "~" : "";
  });
</script>

<span
  class="num {className}"
  title={into === null
    ? undefined
    : `${symbol ?? ""}${formatNumber(value, decimals ?? 2)}`}
  ><span class="font-normal text-cladd-fg-softer"
    >{mark}{shown.symbol ?? ""}</span
  >{formatNumber(shown.amount, shown.decimals ?? 2)}</span
>
