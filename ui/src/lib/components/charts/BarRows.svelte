<script lang="ts">
  import { formatNumber } from "#lib/format.js";
  import {
    type Segment,
    type StackKey,
    type StackRow,
    stack,
  } from "./chart.js";

  const GAP = 2;
  const RADIUS = 4;
  const WIDE_BASE = 200;
  const CHAR = 7;

  let {
    keys,
    rows,
    format = (value: number) => formatNumber(value),
    label = "Bar chart",
    labelWidth = "minmax(6rem, 14rem)",
    onselect,
  }: {
    keys: StackKey[];
    rows: StackRow[];
    format?: (value: number) => string;
    label?: string;
    labelWidth?: string;
    onselect?: (row: StackRow) => void;
  } = $props();

  let list = $state<HTMLElement>();
  let width = $state(0);

  const stacks = $derived(rows.map((row) => ({ row, ...stack(row, keys) })));
  const lo = $derived(Math.min(0, ...stacks.map((s) => s.negative)));
  const hi = $derived(Math.max(0, ...stacks.map((s) => s.positive)));
  const span = $derived(hi - lo || 1);
  const pos = (value: number) => ((value - lo) / span) * 100;
  const total = (s: (typeof stacks)[number]) => s.positive + s.negative;
  const valueText = (s: (typeof stacks)[number]) =>
    s.row.note ?? (s.row.format ?? format)(total(s));
  const wide = $derived(
    width === 0 ||
      width >=
        WIDE_BASE +
          Math.max(0, ...stacks.map((x) => valueText(x).length)) * CHAR
  );

  function box({ from, to, outer }: Segment, first: boolean) {
    const up = to > from;
    const start = pos(Math.min(from, to));
    const size = (Math.abs(to - from) / span) * 100;
    const inset = first ? 0 : GAP;
    let radius = "0";
    if (outer) {
      radius = up
        ? `0 ${RADIUS}px ${RADIUS}px 0`
        : `${RADIUS}px 0 0 ${RADIUS}px`;
    }
    return {
      left: up ? `calc(${start}% + ${inset}px)` : `${start}%`,
      radius,
      width: `max(1px, calc(${size}% - ${inset}px))`,
    };
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const links = [
      ...(list?.querySelectorAll<HTMLElement>("[data-bar-link]") ?? []),
    ];
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (index < 0) {
      return;
    }
    event.preventDefault();
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    links[Math.max(0, Math.min(links.length - 1, next))]?.focus();
  }
</script>

<div bind:clientWidth={width}>
  <ul
    aria-label={label}
    class="grid items-center gap-x-3 text-[12px]"
    bind:this={list}
    style:grid-template-columns={wide
      ? `${labelWidth} minmax(4rem, 1fr) auto`
      : "minmax(0, 1fr) auto"}
  >
    {#each stacks as s (s.row.key)}
      <li
        class="grid grid-cols-subgrid items-center rounded-sm px-1 focus-within:bg-row-cursor hover:bg-row-hover {wide
          ? "col-span-3 h-7"
          : "col-span-2 gap-y-1 py-1.5"}"
      >
        {#if s.row.href}
          <a
            class="col-start-1 row-start-1 truncate text-cladd-fg hover:underline focus-visible:outline-none"
            data-bar-link
            href={s.row.href}
            {onkeydown}
            title={s.row.label}
            >{s.row.label}</a
          >
        {:else if onselect}
          <button
            class="col-start-1 row-start-1 truncate text-left text-cladd-fg hover:underline focus-visible:outline-none"
            data-bar-link
            onclick={() => onselect(s.row)}
            {onkeydown}
            title={s.row.label}
            type="button"
          >
            {s.row.label}
          </button>
        {:else}
          <span
            class="col-start-1 row-start-1 truncate text-cladd-fg"
            title={s.row.label}
            >{s.row.label}</span
          >
        {/if}
        <div
          class="relative h-3 {wide
            ? "col-start-2 row-start-1"
            : "col-span-2 row-start-2"}"
        >
          {#if lo < 0}
            <span
              class="absolute -inset-y-2 w-px bg-cladd-outline"
              style:left="{pos(0)}%"
            ></span>
          {/if}
          {#each s.segments as seg, j (seg.key)}
            {@const b = box(
              seg,
              j === 0 || s.segments[j - 1].value > 0 !== seg.value > 0
            )}
            <span
              class="absolute inset-y-0"
              title="{seg.label}: {(s.row.format ?? format)(seg.value)}"
              style:background={seg.color}
              style:border-radius={b.radius}
              style:left={b.left}
              style:width={b.width}
            ></span>
          {/each}
        </div>
        <span
          class="num row-start-1 text-right text-cladd-fg {wide
            ? "col-start-3"
            : "col-start-2"}"
          >{valueText(s)}</span
        >
      </li>
    {/each}
  </ul>
</div>
