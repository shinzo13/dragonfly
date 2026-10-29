<script lang="ts">
  import { extent } from "d3-array";
  import { scaleLinear } from "d3-scale";
  import {
    area as areaShape,
    curveMonotoneX,
    line as lineShape,
  } from "d3-shape";

  let {
    values,
    color = "var(--ff-series-1)",
    width = 96,
    height = 24,
    marker = -1,
  }: {
    values: number[];
    color?: string;
    width?: number;
    height?: number;
    marker?: number;
  } = $props();

  const PAD = 3;

  const x = $derived(
    scaleLinear()
      .domain([0, Math.max(1, values.length - 1)])
      .range([PAD, width - PAD])
  );
  const y = $derived.by(() => {
    const [lo = 0, hi = 0] = extent(values);
    const pad = lo === hi ? Math.abs(lo) * 0.1 || 1 : 0;
    return scaleLinear()
      .domain([lo - pad, hi + pad])
      .range([height - PAD, PAD]);
  });
  const line = $derived(
    lineShape<number>()
      .x((_, i) => x(i))
      .y((v) => y(v))
      .curve(curveMonotoneX)(values) ?? ""
  );
  const fill = $derived(
    areaShape<number>()
      .x((_, i) => x(i))
      .y0(height - PAD)
      .y1((v) => y(v))
      .curve(curveMonotoneX)(values) ?? ""
  );
  const end = $derived(
    marker >= 0 && marker < values.length ? marker : values.length - 1
  );
</script>

{#if values.length > 1}
  <svg aria-hidden="true" class="block shrink-0" {height} {width}>
    <path d={fill} fill-opacity="0.1" style:fill={color} />
    <path
      d={line}
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      style:stroke={color}
    />
    <circle
      cx={x(end)}
      cy={y(values[end])}
      r="2.5"
      stroke="var(--cladd-surface)"
      stroke-width="1.5"
      style:fill={color}
    />
  </svg>
{/if}
