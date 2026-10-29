<script lang="ts">
  import type { DimensionModel } from "#lib/dimension/model.svelte.js";
  import type { Facet } from "#lib/dimension/spec.js";
  import { type FacetRow, facetRows } from "#lib/dimension/stats.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import FacetRows from "./FacetRows.svelte";

  let {
    model,
    facet,
    current,
    onfacet,
    onnarrow,
    class: className = "",
  }: {
    model: DimensionModel;
    facet: Facet;
    current: string | null;
    onfacet: (facet: Facet) => void;
    onnarrow: (facet: Facet, row: FacetRow) => void;
    class?: string;
  } = $props();

  let focused = $state(false);
  let section = $state<HTMLElement>();

  const labelOf = (f: Facet) =>
    model.dir === 1 && f.incomeLabel ? f.incomeLabel : f.label;
  const rows = $derived(
    facetRows(
      facet,
      model.periodMain,
      model.main,
      model.months,
      model.codes,
      model.weight
    )
  );
  const marker = $derived(model.months.indexOf(model.focus ?? ""));

  useKeys(() =>
    model.spec.facets.map((f, i) => ({
      group: "Inside",
      keys: String(i + 1),
      label: `Inside: ${labelOf(f)}`,
      run: () => {
        onfacet(f);
        focused = true;
      },
    }))
  );
</script>

<svelte:window
  onpointerdown={(event) => {
    if (focused && !section?.contains(event.target as Node)) {
      focused = false;
    }
  }}
/>

<section
  aria-label="Inside"
  class="cladd-surface cladd-outline flex min-w-0 flex-col rounded-cladd-lg {focused
    ? "outline-2 outline-brand"
    : ""} {className}"
  bind:this={section}
>
  <header
    class="flex min-h-10 shrink-0 items-center gap-1 overflow-x-auto border-cladd-outline border-b px-2"
    role="tablist"
  >
    {#each model.spec.facets as f, i (f.id)}
      <button
        aria-selected={f.id === facet.id}
        class="flex h-7 shrink-0 items-center gap-1.5 rounded-cladd-sm px-2 text-[13px] {f.id ===
        facet.id
          ? "bg-cladd-surface-next font-semibold text-cladd-fg"
          : "text-cladd-fg-soft hover:text-cladd-fg"}"
        onclick={() => onfacet(f)}
        role="tab"
        type="button"
      >
        <span class="kbd">{i + 1}</span>
        {labelOf(f)}
      </button>
    {/each}
  </header>
  {#key facet.id}
    <FacetRows
      active={focused}
      {current}
      label={labelOf(facet)}
      loading={model.loading}
      {marker}
      onleave={() => (focused = false)}
      onnarrow={(row) => {
        focused = false;
        onnarrow(facet, row);
      }}
      {rows}
    />
  {/key}
</section>
