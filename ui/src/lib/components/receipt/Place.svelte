<script lang="ts">
  import Box from "#lib/components/Box.svelte";
  import { parse } from "#lib/dates.js";
  import { formatDate, type Money } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import {
    cadence,
    type Place,
    usualOf,
    type Visit,
    verdict,
  } from "./usual.js";

  const HEIGHT = 44;
  const R_MAX = 15;
  const R_MIN = 3;
  const SPREAD = 2.4;
  const RECENT = 6;

  let {
    place,
    current,
    past,
    currency,
    tone,
    loading = false,
  }: {
    place: Place;
    current: Visit;
    past: Visit[];
    currency: Omit<Money, "amount">;
    tone: string;
    loading?: boolean;
  } = $props();

  let width = $state(0);
  let active = $state<Visit | null>(null);

  const visits = $derived(
    [current, ...past].sort((a, b) => a.date.localeCompare(b.date))
  );
  const usual = $derived(usualOf(current, past));
  const said = $derived(usual ? verdict(usual.change) : null);
  const span = $derived.by(() => {
    const times = visits.map((visit) => parse(visit.date).getTime());
    return { from: Math.min(...times), to: Math.max(...times) };
  });
  const biggest = $derived(Math.max(...visits.map((visit) => visit.amount), 1));

  const largest = $derived(
    Math.max(R_MIN + 3, Math.min(R_MAX, width / (visits.length * SPREAD)))
  );
  const recent = $derived(past.slice(0, RECENT));

  const money = (amount: number) => display.text([{ ...currency, amount }]);

  function x(visit: Visit) {
    const room = Math.max(width - 2 * largest, 0);
    const length = span.to - span.from;
    const at = length ? (parse(visit.date).getTime() - span.from) / length : 1;
    return largest + at * room;
  }

  const radius = (visit: Visit) =>
    R_MIN + (largest - R_MIN) * Math.sqrt(visit.amount / biggest);

  function stroke(visit: Visit) {
    if (visit === current) {
      return 0;
    }
    return active === visit ? 2 : 1.25;
  }

  const label = (visit: Visit) =>
    `${formatDate(visit.date)}, ${visit.description}, ${money(visit.amount)}`;
</script>

<Box
  body="flex flex-col gap-2 pt-2.5"
  href="/accounts/show/{place.id}"
  title="{place.from ? "Same route" : "At this place"}{past.length
    ? `, last ${past.length}`
    : ""}"
>
  {#if loading}
    <p class="px-3 pb-2.5 text-cladd-fg-soft">Loading visits...</p>
  {:else if !past.length}
    <p class="px-3 pb-2.5 text-cladd-fg-soft">
      {place.from
        ? "First transfer on this route."
        : `First time at ${place.name}.`}
    </p>
  {:else}
    <p class="flex flex-wrap items-baseline gap-x-1.5 px-3">
      {#if usual}
        <span class="text-cladd-fg-soft">usual</span>
        <span class="num font-medium">{money(usual.median)}</span>
        {#if usual.every !== null}
          <span class="text-cladd-fg-softer">·</span>
          <span>{cadence(usual.every)}</span>
        {/if}
        {#if said}
          <span class="text-cladd-fg-softer">·</span>
          <span class={said.warn ? "text-warn" : "text-cladd-fg-soft"}
            >this one {said.text}</span
          >
        {/if}
      {:else}
        <span class="text-cladd-fg-soft"
          >{past.length === 1 ? "One visit" : `${past.length} visits`}
          before this one</span
        >
      {/if}
    </p>
    <div class="px-3">
      <div bind:clientWidth={width}>
        {#if width}
          <svg
            aria-label="Visits by date, dot size is the amount"
            class="block overflow-visible"
            height={HEIGHT}
            role="img"
            {width}
          >
            <line
              class="stroke-current text-cladd-fg-softest"
              x1={largest}
              x2={width - largest}
              y1={HEIGHT / 2}
              y2={HEIGHT / 2}
            />
            {#each visits as visit (visit.group)}
              {@const self = visit === current}
              <a
                aria-label={label(visit)}
                href="/transactions/show/{visit.group}"
                onblur={() => (active = null)}
                onfocus={() => (active = visit)}
                onpointerenter={() => (active = visit)}
                onpointerleave={() => (active = null)}
              >
                <circle
                  class={self
                    ? `fill-current ${tone}`
                    : `fill-cladd-surface stroke-current ${active === visit ? "text-cladd-fg" : "text-cladd-fg-soft"}`}
                  cx={x(visit)}
                  cy={HEIGHT / 2}
                  r={radius(visit)}
                  stroke-width={stroke(visit)}
                />
              </a>
            {/each}
          </svg>
        {/if}
      </div>
    </div>
    <p
      class="num flex items-baseline justify-between gap-3 px-3 text-[12px] text-cladd-fg-soft"
    >
      <span>{formatDate(visits[0].date)}</span>
      <span>{formatDate(visits.at(-1)?.date)}</span>
    </p>
    <table class="mb-1 w-full border-cladd-outline border-t">
      <tbody>
        {#each recent as visit (visit.group)}
          <tr
            class="h-7 {active === visit ? "bg-row-hover" : ""}"
            onpointerenter={() => (active = visit)}
            onpointerleave={() => (active = null)}
          >
            <td class="num px-3 whitespace-nowrap text-cladd-fg-soft">
              {formatDate(visit.date, "short")}
            </td>
            <td class="w-full max-w-0 truncate px-2">
              <a class="hover:underline" href="/transactions/show/{visit.group}"
                >{visit.description}</a
              >
            </td>
            <td class="num px-3 text-right whitespace-nowrap">
              {money(visit.amount)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Box>
