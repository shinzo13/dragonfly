<script lang="ts">
  import { addDays, today } from "#lib/dates.js";
  import { goto } from "$app/navigation";
  import { view } from "../money.svelte.js";
  import { dayLabel } from "../when.js";

  let {
    data,
    end,
    weeks: count = 53,
  }: { data: Map<string, { count: number; value: number }>; end: string; weeks?: number } = $props();

  const FLOOR = 0.18;
  const PEAK = 0.7;
  const GLOW = 0.55;
  const STEPS = 5;

  let hover = $state<{ date: string; x: number; y: number } | null>(null);
  let width = $state(0);
  const cell = $derived(width ? Math.max(10, (width - 40 - (count - 1) * 4) / count) : 15);

  const last = $derived(end < today() ? end : today());
  const first = $derived.by(() => {
    const d = new Date(`${last}T00:00`);
    const monday = (d.getDay() + 6) % 7;
    return addDays(last, -monday - (count - 1) * 7);
  });
  const weeks = $derived(
    Array.from({ length: count }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)))
  );
  const sorted = $derived([...data.values()].map((v) => v.value).sort((a, b) => a - b));
  const cap = $derived(sorted[Math.floor(0.97 * (sorted.length - 1))] ?? 1);
  const low = $derived(Math.max(1, sorted[Math.floor(0.05 * (sorted.length - 1))] ?? 1, cap / 200));
  const tone = (v: number) => {
    const t = cap > low ? Math.min(1, Math.log(Math.max(v, low) / low) / Math.log(cap / low)) : 1;
    if (t <= PEAK) {
      return `color-mix(in srgb, var(--acc) ${Math.round((FLOOR + ((1 - FLOOR) * t) / PEAK) * 100)}%, var(--sunk))`;
    }
    return `color-mix(in srgb, #fff ${Math.round(((t - PEAK) / (1 - PEAK)) * GLOW * 100)}%, var(--acc))`;
  };
  const legend = $derived(Array.from({ length: STEPS }, (_, i) => low * (cap / low) ** (i / (STEPS - 1))));
  const months = $derived(
    weeks.map((w, i) => (w[0].slice(8) <= "07" && i > 0 ? new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(`${w[0]}T00:00`)) : ""))
  );
  const total = $derived([...data.entries()].filter(([d]) => d >= first && d <= last).reduce((s, [, v]) => s + v.value, 0));
  const quiet = $derived(weeks.flat().filter((d) => d <= last && !data.has(d)).length);
</script>

<div bind:clientWidth={width} class="cal" style:--cell="{cell}px" style:--row="{Math.min(cell, 24)}px" style:--weeks={count}>
  <div class="months">
    {#each months as m, i (i)}<span>{m}</span>{/each}
  </div>
  <div class="body">
    <div class="days small"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>
    <div class="grid" onpointerleave={() => (hover = null)} role="presentation">
      {#each weeks as week, w (w)}
        <div class="week">
          {#each week as date (date)}
            {@const v = data.get(date)?.value ?? 0}

            <button
              aria-label="{dayLabel(date)}: {view.show(v)}"
              class="day"
              class:future={date > last}
              class:spent={v > 0}
              disabled={date > last}
              onclick={() => goto(`/tx?start=${date}&end=${date}`)}
              onpointerenter={(e) => (hover = { date, x: (e.currentTarget as HTMLElement).offsetLeft, y: (e.currentTarget as HTMLElement).offsetTop })}
              style:--c={v > 0 ? tone(v) : null}
              type="button"
            ></button>
          {/each}
        </div>
      {/each}
      {#if hover}
        {@const d = data.get(hover.date)}
        <div class="tip" style:left="{hover.x}px" style:top="{hover.y}px">
          <b>{dayLabel(hover.date)}</b>
          <span>{d ? `${view.show(d.value)} · ${d.count} purchase${d.count === 1 ? "" : "s"}` : "nothing spent"}</span>
        </div>
      {/if}
    </div>
  </div>
  <div class="foot small">
    <span>{view.show(total, { decimals: 0 })} over {count >= 52 ? "the year" : `${Math.round(count / 4.35)} months`} · {quiet} days without spending</span>
    <span class="scale">{#each legend as v, i (i)}<i class="spent" style:--c={tone(v)} title={view.show(v, { decimals: 0 })}></i><span class="tick">{view.show(v, { decimals: 0 })}</span>{/each}</span>
  </div>
</div>

<style>
  .cal {
    --gap: 4px;
  }
  .months {
    display: grid;
    grid-template-columns: repeat(var(--weeks), var(--cell));
    gap: var(--gap);
    margin-left: 40px;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--faint);
    height: 18px;
  }
  .months span {
    white-space: nowrap;
  }
  .body {
    display: flex;
    gap: 8px;
  }
  .days {
    width: 32px;
    display: grid;
    grid-template-rows: repeat(7, var(--row));
    gap: var(--gap);
    font-size: 10.5px;
    align-items: center;
  }
  .grid {
    position: relative;
    display: flex;
    gap: var(--gap);
  }
  .week {
    display: grid;
    grid-template-rows: repeat(7, var(--row));
    gap: var(--gap);
  }
  .scale i {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: var(--c);
  }
  .day {
    width: var(--cell);
    height: var(--row);
    border-radius: 4px;
    border: 0;
    padding: 0;
    background: var(--sunk);
    cursor: pointer;
  }
  .day.spent {
    background: var(--c);
  }
  .day:hover:not(:disabled) {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }
  .day.future {
    background: transparent;
    cursor: default;
  }
  .tip {
    position: absolute;
    transform: translate(-45%, calc(-100% - 8px));
    background: var(--panel);
    box-shadow: var(--pop);
    border-radius: 10px;
    padding: 7px 10px;
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    z-index: 2;
  }
  .tip span {
    color: var(--mute);
  }
  .foot {
    display: flex;
    justify-content: space-between;
    margin: 14px 0 0 40px;
  }
  .scale {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .tick {
    margin-right: 8px;
    font-size: 11px;
  }
  .scale i {
    cursor: default;
    display: inline-block;
  }
</style>
