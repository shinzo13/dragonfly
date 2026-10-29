<script lang="ts">
  import { scaleBand, scaleLinear } from "d3-scale";
  import { compactMoney, formatNumber } from "#lib/format.js";
  import { goto } from "$app/navigation";
  import {
    crisp,
    type LegendItem,
    moveIndex,
    roundedBar,
    type StackKey,
    type StackRow,
    stack,
    textWidth,
    tones,
  } from "./chart.js";
  import Legend from "./Legend.svelte";

  const TOP = 14;
  const RIGHT = 8;
  const GAP_Y = 44;
  const BAR_MAX = 24;
  const GAP = 2;
  const FLAT_BOTTOM = 22;
  const TILTED_BOTTOM = 70;
  const TILTED_CHARS = 16;
  const TILTED_CHAR_WIDTH = 4.9;
  const LABEL_GAP = 13;
  const BARE_BOTTOM = 4;
  const DOT_ROOM = 1.5;
  const DOT_R = 3.5;

  let {
    keys,
    rows,
    height = 240,
    format = (value: number) => formatNumber(value),
    axisFormat = (value: number) => compactMoney(value),
    label = "Bar chart",
    active = $bindable(null),
    selected = null,
    reference = null,
    partial = null,
    dots,
    dotColor = tones.income,
    gutter,
    legend: showLegend = true,
    axis = true,
    tilt = true,
    keyboard = true,
    onselect,
  }: {
    keys: StackKey[];
    rows: StackRow[];
    height?: number;
    format?: (value: number) => string;
    axisFormat?: (value: number) => string;
    label?: string;
    active?: string | null;
    selected?: string | null;
    reference?: number | null;
    partial?: string | null;
    dots?: Record<string, number>;
    dotColor?: string;
    gutter?: number;
    legend?: boolean;
    axis?: boolean;
    tilt?: boolean;
    keyboard?: boolean;
    onselect?: (row: StackRow, segment?: string) => void;
  } = $props();

  const uid = $props.id();
  let width = $state(0);

  const stacks = $derived(rows.map((row) => ({ row, ...stack(row, keys) })));
  const yCount = $derived(Math.max(2, Math.floor((height - 60) / GAP_Y)));
  const stackTop = $derived(Math.max(0, ...stacks.map((s) => s.positive)));
  const dotValues = $derived(
    Object.values(dots ?? {}).filter(
      (v) => v > 0 && (stackTop === 0 || v <= stackTop * DOT_ROOM)
    )
  );
  const yBase = $derived(
    scaleLinear()
      .domain([
        Math.min(0, ...stacks.map((s) => s.negative)),
        Math.max(stackTop, reference ?? 0, ...dotValues) || 1,
      ])
      .nice(yCount)
  );
  const yTicks = $derived(yBase.ticks(yCount));
  const left = $derived(
    gutter ??
      Math.ceil(
        Math.max(24, ...yTicks.map((t) => textWidth(axisFormat(t)))) + 10
      )
  );
  const step = $derived((width - left - RIGHT) / Math.max(1, rows.length));
  const crowded = $derived(
    rows.some((r) => textWidth(r.label, 6.2) > step - 6) && step < 70
  );
  const tilted = $derived(tilt && crowded);
  const flatEvery = $derived(
    crowded && !tilt
      ? Math.ceil(
          (Math.max(...rows.map((r) => textWidth(r.label, 6.2))) + 6) / step
        )
      : 1
  );
  const bottom = $derived.by(() => {
    if (!axis) {
      return BARE_BOTTOM;
    }
    return tilted ? TILTED_BOTTOM : FLAT_BOTTOM;
  });
  const labelEvery = $derived(Math.max(1, Math.ceil(LABEL_GAP / step)));
  const y = $derived(yBase.copy().range([height - bottom, TOP]));
  const x = $derived(
    scaleBand<string>()
      .domain(rows.map((r) => r.key))
      .range([left, Math.max(left + 1, width - RIGHT)])
      .paddingInner(0.3)
      .paddingOuter(0.15)
  );
  const barWidth = $derived(Math.max(2, Math.min(BAR_MAX, x.bandwidth())));
  const zeroY = $derived(y(0));
  const capLabels = $derived(
    keys.length === 1 &&
      stacks.every(
        (s) =>
          textWidth(fmt(s.row, s.positive + s.negative), 6.8) <= x.step() - 6
      )
  );

  const activeIndex = $derived(
    active ? rows.findIndex((r) => r.key === active) : -1
  );
  const selectedIndex = $derived(
    selected ? rows.findIndex((r) => r.key === selected) : -1
  );
  const readRow = $derived(
    rows[Math.max(0, activeIndex >= 0 ? activeIndex : selectedIndex)]
  );
  const yTop = $derived(y.domain()[1]);
  const fmt = (row: StackRow, value: number) => (row.format ?? format)(value);
  const legend = $derived<LegendItem[]>(
    readRow
      ? keys.map((k) => ({
          color: (keys.length === 1 && readRow.color) || k.color,
          key: k.key,
          label: keys.length === 1 ? readRow.label : k.label,
          shape: "rect",
          value: fmt(readRow, readRow.values[k.key] ?? 0),
        }))
      : []
  );
  const valueText = $derived(
    readRow
      ? `${readRow.label}: ${legend.map((l) => `${keys.length > 1 ? `${l.label} ` : ""}${l.value}`).join(", ")}`
      : ""
  );

  function short(text: string, chars: number) {
    return text.length > chars
      ? `${text.slice(0, Math.max(1, chars - 1))}…`
      : text;
  }

  function select(row: StackRow | undefined, segment?: string) {
    if (!row) {
      return;
    }
    if (onselect) {
      onselect(row, segment);
    } else if (row.href) {
      goto(row.href);
    }
  }

  function segmentAt(event: MouseEvent, index: number) {
    const found = stacks[index];
    if (!found) {
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const value = y.invert(event.clientY - box.top);
    return found.segments.find(
      (seg) =>
        value >= Math.min(seg.from, seg.to) &&
        value <= Math.max(seg.from, seg.to)
    )?.key;
  }

  const clickable = $derived(Boolean(onselect) || rows.some((r) => r.href));

  function pick(event: PointerEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offset = event.clientX - box.left - x.range()[0];
    const index = Math.floor(
      offset / x.step() - x.paddingOuter() + x.paddingInner() / 2
    );
    active = rows[Math.max(0, Math.min(rows.length - 1, index))]?.key ?? null;
  }

  function onkeydown(event: KeyboardEvent) {
    if (!keyboard) {
      return;
    }
    if (event.key === "Enter") {
      select(rows[activeIndex]);
      return;
    }
    if (event.key === "Escape" && active) {
      event.preventDefault();
      active = null;
      return;
    }
    const next = moveIndex(event.key, activeIndex, rows.length);
    if (next !== null) {
      event.preventDefault();
      active = rows[next].key;
    }
  }

  function segmentPath(
    cx: number,
    from: number,
    to: number,
    outer: boolean,
    first: boolean
  ) {
    const up = to > from;
    let top = y(Math.max(from, to));
    let bot = y(Math.min(from, to));
    if (!first) {
      if (up) {
        bot -= GAP;
      } else {
        top += GAP;
      }
    }
    const h = Math.max(0, bot - top);
    const xLeft = cx - barWidth / 2;
    if (!outer) {
      return `M${xLeft},${top}h${barWidth}v${h}h${-barWidth}Z`;
    }
    return roundedBar(xLeft, top, barWidth, h, up ? "top" : "bottom");
  }
</script>

<div class="flex min-w-0 flex-col gap-2">
  {#if showLegend}
    <div class="flex min-h-5 flex-wrap items-baseline gap-x-4 gap-y-1">
      {#if keys.length > 1 && readRow}
        <span class="max-w-[16rem] truncate text-[12px] text-cladd-fg"
          >{readRow.label}</span
        >
      {/if}
      <Legend class="min-w-0 flex-1" items={legend} />
    </div>
  {/if}
  <div
    aria-label={label}
    aria-valuemax={Math.max(0, rows.length - 1)}
    aria-valuemin={0}
    aria-valuenow={Math.max(0, activeIndex)}
    aria-valuetext={valueText}
    class="relative rounded-sm {clickable ? "cursor-pointer" : ""}"
    onblur={() => keyboard && (active = null)}
    onclick={(event) =>
      select(rows[activeIndex], segmentAt(event, activeIndex))}
    onfocus={() => keyboard && (active ??= rows[0]?.key ?? null)}
    {onkeydown}
    onpointerleave={() => (active = null)}
    onpointermove={pick}
    role="slider"
    tabindex={keyboard ? 0 : -1}
    style:height="{height}px"
    bind:clientWidth={width}
  >
    {#if width > 0 && rows.length > 0}
      <svg aria-hidden="true" class="block" {height} {width}>
        {#if partial}
          <defs>
            <pattern
              height="5"
              id="{uid}-hatch"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
              width="5"
            >
              <rect fill="var(--cladd-surface)" height="5" width="2" />
            </pattern>
          </defs>
        {/if}
        {#if selectedIndex >= 0}
          <rect
            fill="var(--ff-row-cursor)"
            fill-opacity="0.6"
            height={height - bottom - TOP + 6}
            rx="3"
            width={x.step()}
            x={(x(rows[selectedIndex].key) ?? 0) -
              (x.step() - x.bandwidth()) / 2}
            y={TOP - 6}
          />
        {/if}
        {#each yTicks as tick (tick)}
          <line
            stroke="var(--cladd-outline)"
            x1={left}
            x2={width - RIGHT}
            y1={crisp(y(tick))}
            y2={crisp(y(tick))}
          />
          <text
            class="num"
            dominant-baseline="middle"
            fill="var(--cladd-fg-soft)"
            font-size="11"
            text-anchor="end"
            x={left - 8}
            y={y(tick)}
          >
            {axisFormat(tick)}
          </text>
        {/each}
        <line
          stroke="var(--cladd-fg-softest)"
          x1={left}
          x2={width - RIGHT}
          y1={crisp(zeroY)}
          y2={crisp(zeroY)}
        />
        {#each stacks as s, i (s.row.key)}
          {@const cx = (x(s.row.key) ?? 0) + x.bandwidth() / 2}
          {@const dim = activeIndex >= 0 && activeIndex !== i}
          <g class="transition-opacity duration-100" opacity={dim ? 0.45 : 1}>
            {#each s.segments as seg, j (seg.key)}
              {@const d = segmentPath(
                cx,
                seg.from,
                seg.to,
                seg.outer,
                j === 0 || s.segments[j - 1].value > 0 !== seg.value > 0
              )}
              <path {d} style:fill={seg.color} />
              {#if partial === s.row.key}
                <path {d} fill="url(#{uid}-hatch)" />
              {/if}
            {/each}
          </g>
          {#if capLabels && s.segments[0]}
            {@const text = fmt(s.row, s.segments[0].value)}
            {#if text}
              <text
                class="num"
                fill="var(--cladd-fg-soft)"
                font-size="11"
                text-anchor="middle"
                x={cx}
                y={s.segments[0].value > 0
                  ? y(s.positive) - 5
                  : y(s.negative) + 13}
              >
                {text}
              </text>
            {/if}
          {/if}
          {#if axis && tilted && i % labelEvery === 0}
            <text
              fill={activeIndex === i
                ? "var(--cladd-fg)"
                : "var(--cladd-fg-soft)"}
              font-size="11"
              text-anchor="end"
              transform="translate({cx + 3},{height - bottom + 12}) rotate(-40)"
            >
              {short(
                s.row.label,
                Math.min(TILTED_CHARS, Math.floor(cx / TILTED_CHAR_WIDTH))
              )}
            </text>
          {:else if axis && !tilted && i % flatEvery === 0}
            <text
              fill={activeIndex === i || selectedIndex === i
                ? "var(--cladd-fg)"
                : "var(--cladd-fg-soft)"}
              font-size="11"
              font-weight={selectedIndex === i ? 600 : 400}
              text-anchor="middle"
              x={cx}
              y={height - 6}
            >
              {flatEvery > 1
                ? s.row.label
                : short(s.row.label, Math.floor(x.step() / 6.4))}
            </text>
          {/if}
        {/each}
        {#if reference}
          <line
            stroke="var(--cladd-fg-soft)"
            stroke-dasharray="2 3"
            stroke-width="1.25"
            x1={left}
            x2={width - RIGHT}
            y1={crisp(y(reference))}
            y2={crisp(y(reference))}
          />
        {/if}
        {#each rows as row (row.key)}
          {@const value = dots?.[row.key] ?? 0}
          {#if value > 0}
            {@const cx = (x(row.key) ?? 0) + x.bandwidth() / 2}
            {#if value > yTop}
              <path d="M{cx - 4},{TOP - 1}l4,-6l4,6Z" style:fill={dotColor} />
            {:else}
              <circle
                {cx}
                cy={y(value)}
                r={DOT_R}
                stroke="var(--cladd-surface)"
                stroke-width="1.5"
                style:fill={dotColor}
              />
            {/if}
          {/if}
        {/each}
      </svg>
    {/if}
  </div>
</div>
