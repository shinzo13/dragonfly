<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Calendar from "@lucide/svelte/icons/calendar";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { addDays, addMonths, periodOf, today } from "#lib/dates.js";
  import { period } from "#lib/period.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { periodName } from "../when.js";
  import Menu from "./Menu.svelte";

  let { plain = false }: { plain?: boolean } = $props();

  let start = $state(period.start);
  let end = $state(period.end);

  $effect(() => {
    if (ui.periodOpen) {
      start = period.start;
      end = period.end;
    }
  });

  const presets = $derived.by(() => {
    const now = today();
    const month = periodOf(now, "1M");
    const prev = periodOf(addMonths(month.start, -1), "1M");
    const year = Number(now.slice(0, 4));
    const list = [
      { hint: "[", label: "Previous month", range: prev },
      { hint: ".", label: "This month", range: month },
      { hint: "", label: "Last 30 days", range: { end: now, start: addDays(now, -30) } },
      { hint: "", label: "This year", range: { end: `${year}-12-31`, start: `${year}-01-01` } },
      { hint: "", label: "Last year", range: { end: `${year - 1}-12-31`, start: `${year - 1}-01-01` } },
    ];
    if (period.first) {
      list.push({ hint: "", label: "Everything", range: { end: now, start: period.first } });
    }
    return list;
  });

  function apply(close: () => void) {
    if (start && end && start <= end) {
      period.set({ end, start });
      close();
    }
  }
</script>

<div class="period" class:plain>
  {#if !plain}
  <button type="button" aria-label="Previous period" class="step" onclick={() => period.shift(-1)} title="Previous period  [">
    <ChevronLeft size={16} />
  </button>
  {/if}
  <Menu align={plain ? "right" : "left"} bind:open={ui.periodOpen} width={280}>
    {#snippet trigger({ toggle })}
      <button type="button" class="label" onclick={toggle}>
        {#if plain}
          <span>{periodName(period.start, period.end, true)}</span><ChevronDown size={16} />
        {:else}
          <Calendar size={16} /><span class="text">{periodName(period.start, period.end, true)}</span>
        {/if}
      </button>
    {/snippet}
    {#snippet children({ close })}
      {#each presets as preset (preset.label)}
        <button type="button"
          class="item"
          onclick={() => {
            period.set(preset.range);
            close();
          }}
        >
          {preset.label}
          <span class="hint">{periodName(preset.range.start, preset.range.end, true)}</span>
        </button>
      {/each}
      <div class="sep"></div>
      <div class="label">Custom</div>
      <form
        class="custom"
        onsubmit={(event) => {
          event.preventDefault();
          apply(close);
        }}
      >
        <input bind:value={start} class="field" id="period-start" type="date" />
        <input bind:value={end} class="field" type="date" />
        <button class="btn primary" type="submit">Show</button>
      </form>
    {/snippet}
  </Menu>
  {#if !plain}
  <button type="button" aria-label="Next period" class="step" onclick={() => period.shift(1)} title="Next period  ]">
    <ChevronRight size={16} />
  </button>
  {/if}
</div>

<style>
  .period {
    display: flex;
    align-items: center;
    height: 38px;
    padding: 3px;
    border-radius: 11px;
    background: var(--sunk);
  }
  button.step,
  button.label {
    border: 0;
    background: none;
    cursor: pointer;
    color: var(--mute);
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    transition: background 0.15s, color 0.15s;
  }
  .plain {
    height: auto;
    padding: 0;
    background: none;
  }
  .plain button.label {
    gap: 4px;
    padding: 0;
    font-size: 16px;
    color: var(--acc);
  }
  .plain button.label:hover {
    background: none;
    color: var(--acc);
  }
  button.step {
    width: 30px;
    justify-content: center;
  }
  button.label {
    gap: 8px;
    padding: 0 10px;
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
  }
  .text {
    min-width: 72px;
    text-align: center;
  }
  button.step:hover,
  button.label:hover {
    background: var(--panel);
    color: var(--ink);
  }
  .custom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px;
    padding: 4px 4px 4px;
  }
  .custom .field {
    width: 100%;
    min-width: 0;
    font-size: 12.5px;
    padding: 0 8px;
  }
  .custom .btn {
    grid-column: span 2;
    min-width: 0;
    justify-content: center;
  }
</style>
