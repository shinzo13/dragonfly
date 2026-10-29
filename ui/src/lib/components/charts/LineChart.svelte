<script lang="ts">
  import { bisector, extent } from "d3-array";
  import { scaleLinear, scaleUtc } from "d3-scale";
  import {
    area as areaShape,
    curveMonotoneX,
    line as lineShape,
  } from "d3-shape";
  import { compactMoney, formatDate, formatNumber } from "#lib/format.js";
  import {
    crisp,
    type LegendItem,
    type LinePoint,
    type LineSeries,
    moveIndex,
    seriesColor,
    textWidth,
    utc,
  } from "./chart.js";
  import Legend from "./Legend.svelte";

  const TOP = 16;
  const BOTTOM = 22;
  const RIGHT = 14;
  const GAP_Y = 44;
  const GAP_X = 96;
  const MIN_TICK_GAP = 70;
  const DAY = 86_400_000;

  let {
    series,
    height = 240,
    area = false,
    marker,
    markerLabel = "Today",
    zero = false,
    cursor = $bindable(null),
    axisFormat = (value: number) => compactMoney(value),
    xFormat = (value: string) => formatDate(value, "short"),
    label = "Line chart",
    toggle = true,
  }: {
    series: LineSeries[];
    height?: number;
    area?: boolean;
    marker?: string;
    markerLabel?: string;
    zero?: boolean;
    cursor?: string | null;
    axisFormat?: (value: number) => string;
    xFormat?: (x: string) => string;
    label?: string;
    toggle?: boolean;
  } = $props();

  let width = $state(0);
  let hidden = $state(new Set<string>());

  const colored = $derived(
    series.map((s, i) => ({ ...s, color: s.color ?? seriesColor(i) }))
  );
  const shown = $derived(colored.filter((s) => !hidden.has(s.key)));
  const xs = $derived(
    [...new Set(colored.flatMap((s) => s.points.map((p) => p.x)))].sort()
  );
  const times = $derived(xs.map((day) => utc(day).getTime()));
  const lookup = $derived(
    new Map(
      colored.map((s) => [s.key, new Map(s.points.map((p) => [p.x, p.y]))])
    )
  );

  const yDomain = $derived.by(() => {
    const ys = shown.flatMap((s) => s.points.map((p) => p.y));
    if (zero) {
      ys.push(0);
    }
    const [lo = 0, hi = 0] = extent(ys);
    if (lo === hi) {
      const pad = Math.abs(lo) * 0.1 || 1;
      return [lo - pad, hi + pad];
    }
    return [lo, hi];
  });
  const yCount = $derived(
    Math.max(2, Math.floor((height - TOP - BOTTOM) / GAP_Y))
  );
  const y = $derived(
    scaleLinear()
      .domain(yDomain)
      .nice(yCount)
      .range([height - BOTTOM, TOP])
  );
  const yTicks = $derived(y.ticks(yCount));
  const left = $derived(
    Math.ceil(Math.max(24, ...yTicks.map((t) => textWidth(axisFormat(t)))) + 10)
  );
  const xDomain = $derived.by(() => {
    const first = times[0] ?? 0;
    const last = times.at(-1) ?? first;
    return first === last ? [first - DAY, last + DAY] : [first, last];
  });
  const x = $derived(
    scaleUtc()
      .domain(xDomain)
      .range([left, Math.max(left + 1, width - RIGHT)])
  );
  const xTicks = $derived.by(() => {
    const count = Math.max(3, Math.floor((width - left - RIGHT) / GAP_X));
    const candidates =
      xs.length <= count
        ? xs
        : [...new Set(x.ticks(count).map((d) => d.toISOString().slice(0, 10)))];
    const kept: string[] = [];
    let last = Number.NEGATIVE_INFINITY;
    for (const tick of candidates) {
      const px = x(utc(tick));
      if (px - last >= MIN_TICK_GAP) {
        kept.push(tick);
        last = px;
      }
    }
    return kept;
  });
  const baseline = $derived.by(() => {
    const [lo, hi] = y.domain();
    return y(Math.max(lo, Math.min(0, hi)));
  });
  const zeroInside = $derived(y.domain()[0] < 0 && y.domain()[1] > 0);

  const at = (p: LinePoint) => x(utc(p.x));
  const lineGen = $derived(
    lineShape<LinePoint>()
      .x(at)
      .y((p) => y(p.y))
      .curve(curveMonotoneX)
  );
  const areaGen = $derived(
    areaShape<LinePoint>()
      .x(at)
      .y0(baseline)
      .y1((p) => y(p.y))
      .curve(curveMonotoneX)
  );

  const markerIndex = $derived(marker ? xs.indexOf(marker) : -1);
  const restIndex = $derived(markerIndex >= 0 ? markerIndex : xs.length - 1);
  const index = $derived(cursor ? xs.indexOf(cursor) : -1);
  const readIndex = $derived(index >= 0 ? index : restIndex);
  const readX = $derived(xs[readIndex]);
  const readLabel = $derived.by(() => {
    if (!readX) {
      return "";
    }
    if (index < 0 && markerIndex >= 0) {
      return markerLabel;
    }
    return formatDate(readX, "day");
  });

  const fmt = (s: LineSeries, value: number) =>
    s.format ? s.format(value) : formatNumber(value);
  const widths = $derived(
    Object.fromEntries(
      colored.map((s) => [
        s.key,
        Math.max(0, ...s.points.map((p) => fmt(s, p.y).length)),
      ])
    )
  );
  const legend = $derived<LegendItem[]>(
    colored.map((s) => {
      const value = readX ? lookup.get(s.key)?.get(readX) : undefined;
      return {
        color: s.color,
        hidden: hidden.has(s.key),
        key: s.key,
        label: s.label,
        shape: "line",
        value: value === undefined ? "" : fmt(s, value),
      };
    })
  );
  const valueText = $derived(
    [readLabel, ...legend.map((l) => `${l.label} ${l.value}`)].join(", ")
  );

  function flip(key: string) {
    const next = new Set(hidden);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    hidden = next;
  }

  function pick(event: PointerEvent) {
    if (xs.length === 0) {
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const t = x.invert(event.clientX - box.left).getTime();
    cursor = xs[bisector((v: number) => v).center(times, t)] ?? null;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && cursor) {
      event.preventDefault();
      cursor = null;
      return;
    }
    const next = moveIndex(event.key, readIndex, xs.length);
    if (next === null) {
      return;
    }
    event.preventDefault();
    cursor = xs[next];
  }

  function xAnchor(tick: string) {
    const px = x(utc(tick));
    if (px - left < 24) {
      return "start";
    }
    return width - RIGHT - px < 24 ? "end" : "middle";
  }
</script>

<div class="flex min-w-0 flex-col gap-2">
  <div class="flex min-h-5 flex-wrap items-baseline gap-x-4 gap-y-1">
    <span class="num w-[11ch] shrink-0 text-[12px] text-cladd-fg-soft"
      >{readLabel}</span
    >
    <Legend
      class="min-w-0 flex-1"
      items={legend}
      ontoggle={toggle && colored.length > 1 ? flip : undefined}
      {widths}
    />
  </div>
  <div
    aria-label={label}
    aria-valuemax={Math.max(0, xs.length - 1)}
    aria-valuemin={0}
    aria-valuenow={readIndex}
    aria-valuetext={valueText}
    class="relative touch-pan-y rounded-sm"
    onblur={() => (cursor = null)}
    onfocus={() => (cursor ??= xs[restIndex] ?? null)}
    {onkeydown}
    onpointerleave={() => (cursor = null)}
    onpointermove={pick}
    role="slider"
    tabindex="0"
    style:height="{height}px"
    bind:clientWidth={width}
  >
    {#if width > 0 && xs.length > 0}
      <svg aria-hidden="true" class="block" {height} {width}>
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
        {#if zeroInside}
          <line
            stroke="var(--cladd-fg-softest)"
            x1={left}
            x2={width - RIGHT}
            y1={crisp(y(0))}
            y2={crisp(y(0))}
          />
        {/if}
        {#each xTicks as tick (tick)}
          <text
            fill="var(--cladd-fg-soft)"
            font-size="11"
            text-anchor={xAnchor(tick)}
            x={x(utc(tick))}
            y={height - 6}
          >
            {xFormat(tick)}
          </text>
        {/each}
        {#if markerIndex >= 0}
          {@const mx = crisp(x(utc(xs[markerIndex])))}
          <line
            stroke="var(--cladd-fg-softer)"
            x1={mx}
            x2={mx}
            y1={TOP - 2}
            y2={height - BOTTOM}
          />
          <text
            fill="var(--cladd-fg-soft)"
            font-size="10"
            text-anchor={mx > width - 60 ? "end" : "middle"}
            x={mx}
            y={TOP - 5}
          >
            {markerLabel}
          </text>
        {/if}
        {#each shown as s (s.key)}
          {#if area || s.area}
            <path
              d={areaGen(s.points)}
              fill-opacity="0.1"
              style:fill={s.color}
            />
          {/if}
          <path
            d={lineGen(s.points)}
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={s.strong ? 2.5 : 2}
            style:stroke={s.color}
          />
        {/each}
        {#if index >= 0}
          {@const cx = crisp(x(utc(xs[index])))}
          <line
            stroke="var(--cladd-fg-soft)"
            x1={cx}
            x2={cx}
            y1={TOP}
            y2={height - BOTTOM}
          />
          {#each shown as s (s.key)}
            {@const value = lookup.get(s.key)?.get(xs[index])}
            {#if value !== undefined}
              <circle
                cx={x(utc(xs[index]))}
                cy={y(value)}
                r="4"
                stroke="var(--cladd-surface)"
                stroke-width="2"
                style:fill={s.color}
              />
            {/if}
          {/each}
        {/if}
      </svg>
    {/if}
  </div>
</div>
