<script lang="ts" module>
  export type Column =
    | "name"
    | "month"
    | "share"
    | "visits"
    | "avg"
    | "spark"
    | "typical"
    | "change"
    | "last"
    | "category";
</script>

<script lang="ts">
  import type { Kind, Line, Merchant } from "#lib/accounts/merchants.js";
  import { showUrl } from "#lib/components/accounts/links.js";
  import { currency } from "#lib/components/dashboard/data.js";
  import { today } from "#lib/dates.js";
  import { formatDate, formatMoney, percent } from "#lib/format.js";
  import MonthSpark from "./MonthSpark.svelte";

  const LOUD = 0.15;
  const SMALL = 0.005;

  let {
    col,
    merchant: m,
    kind,
    compare,
    max,
    past,
    note = "",
  }: {
    col: Column;
    merchant: Merchant;
    kind: Kind;
    compare: boolean;
    max: number;
    past: number;
    note?: string;
  } = $props();

  const money = (line: Line, amount: number, decimals?: number) => {
    const cur = currency(line.code);
    const text = formatMoney({
      ...cur,
      amount,
      decimals: decimals ?? cur.decimals,
    });
    return line.approx ? `≈${text}` : text;
  };

  function change(line: Line): [string, string] {
    if (!compare || m.quiet) {
      return ["", ""];
    }
    if (line.seen === 0) {
      return ["new", "text-warn"];
    }
    if (line.ratio === null) {
      return [`${line.seen} of ${past} months`, "text-cladd-fg-soft"];
    }
    const pct = Math.round(line.ratio * 100);
    let sign = "";
    if (pct !== 0) {
      sign = pct > 0 ? "+" : "−";
    }
    const bad = kind === "expense" ? line.ratio > LOUD : line.ratio < -LOUD;
    return [
      `${sign}${percent(Math.abs(line.ratio))}`,
      bad ? "text-expense" : "text-cladd-fg-soft",
    ];
  }

  const lastText = $derived(
    m.last.slice(0, 4) === today().slice(0, 4)
      ? formatDate(m.last, "short")
      : formatDate(m.last)
  );
</script>

{#if col === "name"}
  <a
    class="block max-w-[9rem] truncate sm:max-w-[18rem] text-brand dark:text-(--ff-series-1) hover:underline"
    href={showUrl(m.id)}
    title={m.name}
    >{m.name}</a
  >
{:else if col === "month"}
  {#each m.lines as line (line.code)}
    <div class="num">{line.amount ? money(line, line.amount) : ""}</div>
  {/each}
{:else if col === "share"}
  {#if m.share > 0}
    <div class="flex items-center gap-2">
      <div class="h-2 w-16 shrink-0">
        <div
          class="h-full rounded-[2px] bg-brand/70"
          style:width="{Math.max(2, (m.share / (max || 1)) * 100)}%"
        ></div>
      </div>
      <span class="num w-8 text-right text-cladd-fg-soft"
        >{m.share < SMALL ? "<1%" : percent(m.share)}</span
      >
    </div>
  {/if}
{:else if col === "visits"}
  <span class="num">{m.visits || ""}</span>
{:else if col === "avg"}
  {#each m.lines as line (line.code)}
    <div class="num text-cladd-fg-soft">
      {line.visits ? money(line, line.amount / line.visits, 0) : ""}
    </div>
  {/each}
{:else if col === "spark"}
  {#each m.lines as line (line.code)}
    <div class="flex h-[1lh] items-center justify-end">
      <MonthSpark typical={line.typical} values={line.months} />
    </div>
  {/each}
{:else if col === "typical"}
  {#each m.lines as line (line.code)}
    {@const value = compare && !m.quiet ? line.base : line.typical}
    <div class="num text-cladd-fg-soft">
      {value ? money(line, value, 0) : ""}
    </div>
  {/each}
{:else if col === "change"}
  {#each m.lines as line (line.code)}
    {@const [text, tone] = change(line)}
    <div class="num {tone}">{text}</div>
  {/each}
{:else if col === "last"}
  <span class="num text-cladd-fg-soft">{lastText}</span>
{:else}
  <span class="flex max-w-[16rem] items-baseline gap-1.5">
    <span class="truncate {m.category ? "" : "text-cladd-fg-softer"}"
      >{m.category ?? "none"}</span
    >
    {#if m.others}
      <span class="shrink-0 text-cladd-fg-softer">+{m.others}</span>
    {/if}
    {#if note}
      <span class="shrink-0 text-cladd-fg-soft">{note}</span>
    {/if}
  </span>
{/if}
