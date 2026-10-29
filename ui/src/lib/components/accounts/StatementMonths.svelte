<script lang="ts">
  import {
    type Side,
    type Sums,
    terms,
    viewOf,
  } from "#lib/accounts/statement.js";
  import Columns from "#lib/components/charts/Columns.svelte";
  import {
    type LegendItem,
    type StackRow,
    tones,
    wash,
  } from "#lib/components/charts/chart.js";
  import Legend from "#lib/components/charts/Legend.svelte";
  import { currentLocale, type Money } from "#lib/format.js";

  const NARROW = 560;
  const COLOR = {
    expense: tones.expense,
    income: tones.income,
    neutral: "var(--cladd-fg-softer)",
    transfer: wash(tones.transfer, 55),
  };

  let {
    months,
    side,
    cur,
    moved,
    selected,
    partial,
    onselect,
  }: {
    months: { month: string; total: Sums }[];
    side: Side;
    cur: Omit<Money, "amount">;
    moved: boolean;
    selected: string | null;
    partial: string | null;
    onselect: (month: string) => void;
  } = $props();

  let hover = $state<string | null>(null);
  let width = $state(0);

  const name = (month: string, style: "narrow" | "short" | "long") =>
    new Date(`${month.slice(0, 7)}-15T12:00:00`).toLocaleDateString(
      currentLocale(),
      style === "long" ? { month: "long", year: "numeric" } : { month: style }
    );
  const view = $derived(viewOf(cur));
  const format = (value: number) => view.format(value, true);

  const parts = $derived(
    months.map((m) => ({
      month: m.month,
      terms: terms(side, m.total).slice(0, 4),
    }))
  );
  const keys = $derived(
    (parts[0]?.terms ?? [])
      .filter((t) => moved || t.tone !== "transfer")
      .map((t) => ({ color: COLOR[t.tone], key: t.flow, label: t.label }))
  );
  const rows = $derived<StackRow[]>(
    parts.map((p) => ({
      key: p.month,
      label: name(p.month, width < NARROW ? "narrow" : "short"),
      values: Object.fromEntries(
        p.terms.map((t) => [t.flow, t.value * view.rate])
      ),
    }))
  );
  const read = $derived(hover ?? selected ?? rows.at(-1)?.key ?? null);
  const row = $derived(rows.find((r) => r.key === read));
  const legend = $derived<LegendItem[]>(
    keys.map((k) => ({
      ...k,
      shape: "rect",
      value: format(row?.values[k.key] ?? 0),
    }))
  );
</script>

<div class="flex min-w-0 flex-col gap-2" bind:clientWidth={width}>
  <div class="flex min-h-5 flex-wrap items-baseline gap-x-4 gap-y-1">
    <span class="w-[8.5rem] shrink-0 text-[12px] text-cladd-fg"
      >{read ? name(read, "long") : ""}</span
    >
    <Legend class="min-w-0 flex-1" items={legend} />
  </div>
  <Columns
    axisFormat={view.axis}
    {format}
    height={208}
    {keys}
    label="Money in and out by month"
    legend={false}
    onselect={(r) => onselect(r.key)}
    {partial}
    {rows}
    {selected}
    bind:active={hover}
  />
</div>
