<script lang="ts">
  import { type MeterSegment, seriesColor, wash } from "./chart.js";

  const GAP = 2;

  let {
    segments,
    max,
    height = 8,
    track,
    label,
  }: {
    segments: MeterSegment[];
    max: number;
    height?: number;
    track?: string;
    label?: string;
  } = $props();

  const total = $derived(
    segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  );
  const scale = $derived(Math.max(max, total) || 1);
  const parts = $derived(
    segments
      .filter((s) => s.value > 0)
      .map((s, i) => ({
        ...s,
        color: s.color ?? seriesColor(i),
        share: (s.value / scale) * 100,
      }))
  );
  const trackColor = $derived(track ?? wash(parts[0]?.color ?? seriesColor(0)));
  const title = $derived(
    label ??
      segments
        .filter((s) => s.label)
        .map((s) => s.label)
        .join(", ")
  );
</script>

<div
  aria-hidden="true"
  class="flex w-full overflow-hidden rounded-full"
  {title}
  style:background={trackColor}
  style:gap="{GAP}px"
  style:height="{height}px"
>
  {#each parts as part, i (i)}
    <span
      class="h-full shrink-0 first:rounded-l-full last:rounded-r-full"
      style:background={part.color}
      style:width="calc({part.share}% - {i === 0 ? 0 : GAP}px)"
    ></span>
  {/each}
</div>
