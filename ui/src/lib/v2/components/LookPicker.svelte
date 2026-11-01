<script lang="ts">
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Search from "@lucide/svelte/icons/search";
  import Trash from "@lucide/svelte/icons/trash-2";
  import Upload from "@lucide/svelte/icons/upload";
  import X from "@lucide/svelte/icons/x";
  import { fuzzyFilter } from "#lib/fuzzy.js";
  import { glyphs } from "../glyphs.svelte.js";
  import { look, type LookKind, PALETTE } from "../look.svelte.js";
  import Chip from "./Chip.svelte";
  import Glyph from "./Glyph.svelte";

  let {
    open = $bindable(false),
    kind,
    id,
    name,
    role,
  }: { open?: boolean; kind: LookKind; id: string; name: string; role?: string } = $props();

  let dialog = $state<HTMLDialogElement>();
  let query = $state("");
  let error = $state("");
  let busy = $state(false);
  let file = $state<HTMLInputElement>();

  const current = $derived(look.of(kind, id, name, role));
  const FAVOURITES = [
    "landmark", "credit-card", "wallet", "piggy-bank", "banknote", "coins", "gem", "bitcoin", "bot", "cat", "dog",
    "shopping-basket", "shopping-cart", "shopping-bag", "store", "package", "coffee", "utensils", "pizza", "sandwich",
    "beef", "milk", "carrot", "apple", "croissant", "cake-slice", "cookie", "wine", "beer", "cup-soda", "soup", "wheat",
    "house", "building-2", "key-round", "lightbulb", "flame", "droplets", "wifi", "smartphone", "laptop", "tv", "gamepad-2",
    "tram-front", "bus", "car", "fuel", "bike", "plane", "train-front", "map-pin", "ticket", "film", "music", "book-open",
    "graduation-cap", "briefcase", "heart-pulse", "pill", "stethoscope", "dumbbell", "sparkles", "shirt", "scissors",
    "gift", "baby", "paw-print", "receipt", "landmark", "scale", "shield", "repeat", "arrow-left-right", "arrow-down-left",
    "sparkle", "globe", "cloud", "server", "tag", "star", "heart", "shapes",
  ];
  const names = $derived(
    query.trim()
      ? fuzzyFilter(glyphs.names, query, (n) => n, 280)
      : [...new Set([...FAVOURITES.filter((n) => glyphs.nodes[n]), ...glyphs.names])].slice(0, 280)
  );
  const uploads = $derived(Object.keys(look.svgs).map((key) => `svg:${key}`));

  $effect(() => {
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      query = "";
      error = "";
      glyphs.load();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  });

  async function apply(change: { icon?: string; color?: string }) {
    busy = true;
    error = "";
    try {
      await look.set(kind, id, change);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function upload(event: Event) {
    const picked = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!picked) {
      return;
    }
    busy = true;
    try {
      const icon = await look.upload(picked);
      await look.set(kind, id, { icon });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
      if (file) {
        file.value = "";
      }
    }
  }
</script>

<dialog
  bind:this={dialog}
  aria-label="Icon and colour"
  onclick={(event) => event.target === dialog && (open = false)}
  onclose={() => (open = false)}
>
  <div class="box">
    <div class="head">
      <Chip color={current.color} icon={current.icon} size={44} />
      <div class="title">
        <h1>{name}</h1>
        <span class="small">Icon and colour</span>
      </div>
      <button class="btn" disabled={busy} onclick={() => look.reset(kind, id)} title="Back to the automatic look"><RotateCcw size={15} />Reset</button>
      <button aria-label="Close" class="ib" onclick={() => (open = false)}><X size={16} /></button>
    </div>

    <div class="colors">
      {#each PALETTE as color (color)}
        <button
          aria-label="Colour {color}"
          class="swatch"
          class:on={color.toLowerCase() === current.color.toLowerCase()}
          disabled={busy}
          onclick={() => apply({ color })}
          style:background={color}
        ></button>
      {/each}
      <label class="swatch custom" title="Any colour">
        <input onchange={(e) => apply({ color: e.currentTarget.value })} type="color" value={current.color} />
      </label>
    </div>

    <div class="tools">
      <label class="find">
        <Search size={16} />
        <!-- svelte-ignore a11y_autofocus -->
        <input autofocus bind:value={query} placeholder="Search {glyphs.names.length || ''} icons: bank, coffee, cat…" />
      </label>
      <button class="btn" disabled={busy} onclick={() => file?.click()}><Upload size={15} />Upload SVG</button>
      <input accept=".svg,image/svg+xml" bind:this={file} hidden onchange={upload} type="file" />
    </div>
    {#if error}<p class="error">{error}</p>{/if}

    <div class="icons">
      {#each uploads as icon (icon)}
        <div class="own">
          <button class="icon" class:on={icon === current.icon} disabled={busy} onclick={() => apply({ icon })} title="Your upload">
            <Glyph name={icon} size={22} />
          </button>
          <button aria-label="Delete upload" class="del" onclick={() => look.removeSvg(icon)}><Trash size={11} /></button>
        </div>
      {/each}
      {#each names as icon (icon)}
        <button class="icon" class:on={icon === current.icon} disabled={busy} onclick={() => apply({ icon })} title={icon}>
          <Glyph name={icon} size={20} />
        </button>
      {/each}
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: 0;
    padding: 0;
    background: transparent;
    margin: 10vh auto auto;
    width: min(640px, calc(100vw - 32px));
  }
  dialog::backdrop {
    background: var(--scrim, #0006);
  }
  .box {
    background: var(--panel);
    color: var(--ink);
    border-radius: 20px;
    box-shadow: var(--pop);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .title {
    flex: 1;
    min-width: 0;
  }
  .title h1 {
    font-size: 17px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ib {
    border: 0;
  }
  .colors {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 0;
    cursor: pointer;
    box-shadow: inset 0 0 0 1px #0000001f;
    transition: transform 0.12s;
  }
  .swatch:hover {
    transform: scale(1.1);
  }
  .swatch.on {
    box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink);
  }
  .custom {
    background: conic-gradient(#e5484d, #eab308, #16a34a, #0e94d6, #7c5cff, #e13d8b, #e5484d);
    position: relative;
    overflow: hidden;
  }
  .custom input {
    opacity: 0;
    position: absolute;
    inset: 0;
    cursor: pointer;
  }
  .tools {
    display: flex;
    gap: 8px;
  }
  .find {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 38px;
    padding: 0 12px;
    border-radius: 11px;
    background: var(--sunk);
    color: var(--faint);
  }
  .find input {
    flex: 1;
    border: 0;
    outline: 0 !important;
    background: none;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }
  .icon {
    height: 42px;
    border-radius: 10px;
    border: 0;
    background: none;
    display: grid;
    place-items: center;
    color: var(--ink);
    cursor: pointer;
  }
  .icon:hover {
    background: var(--sunk);
  }
  .icon.on {
    background: var(--acc-soft);
    color: var(--acc);
  }
  .own {
    position: relative;
  }
  .own .icon {
    width: 100%;
  }
  .del {
    position: absolute;
    top: 0;
    right: 0;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 0;
    background: var(--ink);
    color: var(--panel);
    display: none;
    place-items: center;
    cursor: pointer;
  }
  .own:hover .del {
    display: grid;
  }
  .error {
    color: var(--neg);
    font-size: 13px;
    font-weight: 600;
  }
</style>
