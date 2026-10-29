<script lang="ts">
  let {
    values,
    typical = 0,
    width = 72,
    height = 14,
  }: {
    values: number[];
    typical?: number;
    width?: number;
    height?: number;
  } = $props();

  const GAP = 1;

  const max = $derived(Math.max(typical, ...values) || 1);
  const step = $derived(width / Math.max(1, values.length));
  const y = (value: number) => height - (value / max) * height;
</script>

<svg aria-hidden="true" class="block shrink-0" {height} {width}>
  {#each values as value, i (i)}
    {#if value > 0}
      <rect
        class={i === values.length - 1
          ? "fill-brand"
          : "fill-cladd-fg-softer opacity-60"}
        height={Math.max(1, height - y(value))}
        width={Math.max(1, step - GAP)}
        x={i * step}
        y={Math.min(y(value), height - 1)}
      />
    {/if}
  {/each}
  {#if typical > 0}
    <line
      class="stroke-cladd-fg"
      stroke-dasharray="2 2"
      stroke-width="1"
      x1="0"
      x2={width}
      y1={y(typical) + 0.5}
      y2={y(typical) + 0.5}
    />
  {/if}
</svg>
