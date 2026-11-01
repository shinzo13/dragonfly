<script lang="ts">
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Split from "@lucide/svelte/icons/split";
  import { look } from "../look.svelte.js";
  import { money, view } from "../money.svelte.js";
  import type { Row } from "../tx.js";
  import { rowValue } from "../stats.js";
  import Chip from "./Chip.svelte";
  import Tag from "./Tag.svelte";

  let {
    row,
    cursor = false,
    showAccount = true,
    id,
    dir,
    compact = false,
  }: { row: Row; cursor?: boolean; showAccount?: boolean; id?: string; dir?: number; compact?: boolean } = $props();

  const KIND_LOOK = {
    in: { color: "#16A34A", icon: "arrow-down-left" },
    move: { color: "#64748B", icon: "arrow-left-right" },
    out: { color: "#8B95A5", icon: "shapes" },
  };

  const l = $derived(row.categoryId ? look.of("category", row.categoryId, row.category ?? "") : KIND_LOOK[row.kind]);
  const acc = $derived(look.of("account", row.accountId, row.account));
  const value = $derived(rowValue(row));
  const foreign = $derived(view.foreign(row.code));
  const sign = $derived(dir ?? (row.kind === "out" ? -1 : 1));
</script>

<a class="row" class:compact class:cursor class:show={showAccount} href="/tx/{row.id}" {id}>
  <Chip color={l.color} icon={l.icon} size={30} />
  <div class="main">
    <span class="title">{row.title}</span>
    {#if row.splits.length > 1}
      <span class="small splits"><Split size={13} />{row.splits.length}</span>
    {/if}
    {#if !compact}
      {#each row.tags.slice(0, 2) as tag (tag)}<Tag {tag} />{/each}
      {#if row.tags.length > 2}<span class="small">+{row.tags.length - 2}</span>{/if}
    {/if}
  </div>
  <span class="small cat">
    {#if row.kind === "move"}
      <ArrowLeftRight size={13} />{row.other}
    {:else}
      <i class="dot" style:background={l.color}></i><span class="clip">{row.category ?? (row.kind === "in" ? "Income" : "No category")}</span>
    {/if}
  </span>
  {#if showAccount}
    <span class="small acc"><Chip color={acc.color} icon={acc.icon} size={18} radius={5} />{row.account}</span>
  {/if}
  <div class="sum">
    <div class:pos={sign > 0 && row.kind !== "move"} data-copy>{view.each(sign * value, sign * Math.abs(row.amount), row.code, { signed: sign > 0 && row.kind !== "move" })}</div>
    {#if foreign}<div class="small orig" data-copy>{money(Math.abs(row.amount), row.code)}</div>{/if}
  </div>
  <ChevronRight class="go" size={16} />
</a>

<style>
  .row {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 170px 150px 130px 16px;
    align-items: center;
    gap: 14px;
    min-height: 46px;
    padding: 5px 16px;
    border-radius: 12px;
    transition: background 0.12s;
  }
  .row:not(.show) {
    grid-template-columns: 30px minmax(0, 1fr) 170px 130px 16px;
  }
  .row.compact {
    grid-template-columns: 30px minmax(0, 1fr) 140px 110px 16px;
    gap: 12px;
  }
  .row:hover,
  .row.cursor {
    background: var(--hover);
  }
  .row.cursor {
    box-shadow: inset 0 0 0 1.5px var(--acc-soft);
  }
  .main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }
  .title {
    font-size: 14.5px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
  }
  .splits {
    display: flex;
    align-items: center;
    gap: 3px;
    flex: none;
  }
  .cat,
  .acc {
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cat {
    color: var(--ink);
  }
  .clip {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sum {
    text-align: right;
    line-height: 1.15;
    font-size: 14.5px;
    font-weight: 800;
    white-space: nowrap;
  }
  .orig {
    font-size: 11.5px;
  }
  @media (max-width: 760px) {
    .row,
    .row:not(.show),
    .row.compact {
      grid-template-columns: 36px minmax(0, 1fr) auto;
      grid-template-areas: "chip main sum" "chip cat sum";
      column-gap: 12px;
      row-gap: 1px;
      padding: 9px 6px;
    }
    .row > :global(:first-child) {
      grid-area: chip;
      width: 36px !important;
      height: 36px !important;
    }
    .main {
      grid-area: main;
    }
    .main :global(.tag) {
      display: none;
    }
    .cat {
      grid-area: cat;
      color: var(--mute);
    }
    .acc,
    .row :global(.go) {
      display: none;
    }
    .sum {
      grid-area: sum;
    }
  }
  .row :global(.go) {
    color: var(--faint);
    opacity: 0;
  }
  .row:hover :global(.go),
  .row.cursor :global(.go) {
    opacity: 1;
  }
</style>
