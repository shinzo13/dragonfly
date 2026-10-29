<script lang="ts">
  import type { Side, Term } from "#lib/accounts/statement.js";
  import { addDays } from "#lib/dates.js";
  import { formatDate, formatMoney, type Money } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";

  let {
    terms,
    opening,
    closing,
    side,
    cur,
    start,
    end,
    loading = false,
    empty = false,
  }: {
    terms: Term[];
    opening: number;
    closing: number;
    side: Side;
    cur: Omit<Money, "amount">;
    start: string;
    end: string;
    loading?: boolean;
    empty?: boolean;
  } = $props();

  const TONE = {
    expense: "text-expense",
    income: "text-income",
    neutral: "text-cladd-fg",
    transfer: "text-transfer",
  };

  function word(value: number, asset: string) {
    if (side === "asset") {
      return asset;
    }
    return (side === "credit") === value >= 0 ? "Owed to you" : "You owe";
  }

  const shown = (value: number) => (side === "asset" ? value : Math.abs(value));
  const change = $derived(closing - opening);
  const changeTone = $derived.by(() => {
    if (side !== "asset" || Math.abs(change) < 0.005) {
      return "text-cladd-fg-soft";
    }
    return change > 0 ? "text-income" : "text-expense";
  });
  const items = $derived([
    {
      key: "open",
      label: `${word(opening, "Opening")}, ${formatDate(addDays(start, -1), "short")}`,
      op: "",
      tone: "text-cladd-fg",
      value: shown(opening),
    },
    ...terms.map((t) => ({
      key: t.flow,
      label: t.label,
      op: t.up ? "+" : "−",
      tone: Math.abs(t.value) < 0.005 ? "text-cladd-fg-soft" : TONE[t.tone],
      value: Math.abs(t.value),
    })),
    {
      key: "close",
      label: `${word(closing, "Closing")}, ${formatDate(end, "short")}`,
      op: "=",
      tone: "text-cladd-fg",
      value: shown(closing),
    },
  ]);
  const money = (amount: number, signed = false) =>
    empty ? " " : display.text([{ ...cur, amount }], signed);
  const original = (amount: number, signed = false) =>
    display.total([{ ...cur, amount }])?.converted
      ? formatMoney({ ...cur, amount }, signed)
      : undefined;
</script>

<section
  aria-busy={loading}
  aria-label="Balance change"
  class="cladd-surface cladd-outline rounded-cladd-lg px-3 py-3 transition-opacity lg:px-4 {loading
    ? "opacity-60"
    : ""}"
>
  <div
    class="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 lg:flex lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-3"
  >
    {#each items as item (item.key)}
      <div
        class="col-span-3 grid grid-cols-subgrid items-baseline lg:grid-cols-[auto_auto] lg:gap-x-2 {item.key ===
        "close"
          ? "border-cladd-outline max-lg:mt-1 max-lg:border-t max-lg:pt-1"
          : ""}"
      >
        <span
          aria-hidden="true"
          class="text-center text-[18px] text-cladd-fg-softer leading-tight lg:col-start-1 lg:row-start-2 lg:text-[22px] {item.op
            ? ""
            : "lg:hidden"}"
          >{item.op}</span
        >
        <span
          class="truncate text-[13px] text-cladd-fg-soft lg:col-start-2 lg:row-start-1 lg:text-[12px]"
          >{item.label}</span
        >
        <span
          class="num text-right font-semibold text-[18px] leading-tight tracking-[-0.02em] lg:col-start-2 lg:row-start-2 lg:text-left lg:text-[22px] {item.tone}"
          title={original(item.value)}
          >{money(item.value)}</span
        >
      </div>
    {/each}
    <div
      class="col-span-3 grid grid-cols-subgrid items-baseline lg:ml-auto lg:flex lg:flex-col lg:items-end"
    >
      <span class="col-start-2 text-[13px] text-cladd-fg-soft lg:text-[12px]"
        >Change</span
      >
      <span
        class="num text-right font-semibold text-[15px] {changeTone}"
        title={original(change, true)}
        >{money(change, true)}</span
      >
    </div>
  </div>
</section>
