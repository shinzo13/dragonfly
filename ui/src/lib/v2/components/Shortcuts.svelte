<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { keys, prettyKeys } from "#lib/keys.svelte.js";

  let dialog = $state<HTMLDialogElement>();

  const ORDER = ["Go to", "Everywhere", "Older interfaces", "List", "Page"];

  const groups = $derived.by(() => {
    const map = new Map<string, { keys: string; label: string }[]>();
    const seen = new Set<string>();
    for (const binding of [...keys.all].reverse()) {
      if (binding.hidden || seen.has(binding.keys)) {
        continue;
      }
      seen.add(binding.keys);
      const group = binding.group ?? "Page";
      map.set(group, [binding, ...(map.get(group) ?? [])]);
    }
    return [...map.entries()].sort(
      ([a], [b]) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99
    );
  });

  $effect(() => {
    if (keys.sheetOpen && dialog && !dialog.open) {
      dialog.showModal();
    } else if (!keys.sheetOpen && dialog?.open) {
      dialog.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  aria-label="Keyboard shortcuts"
  onclick={(event) => event.target === dialog && (keys.sheetOpen = false)}
  onclose={() => (keys.sheetOpen = false)}
  onkeydown={(event) => event.key === "?" && (keys.sheetOpen = false)}
>
  <div class="box">
    <div class="head">
      <h1>Keyboard shortcuts</h1>
      <span class="small">Everything is also in <kbd>{prettyKeys("mod+k")[0]}</kbd></span>
      <button aria-label="Close" class="ib" onclick={() => (keys.sheetOpen = false)}><X size={16} /></button>
    </div>
    <div class="grid">
      {#each groups as [group, list] (group)}
        <section>
          <div class="group">{group}</div>
          {#each list as binding (binding.keys)}
            <div class="row">
              <span>{binding.label}</span>
              <span class="keys">{#each prettyKeys(binding.keys) as key, i (i)}<kbd>{key}</kbd>{/each}</span>
            </div>
          {/each}
        </section>
      {/each}
    </div>
  </div>
</dialog>

<style>
  dialog {
    border: 0;
    padding: 0;
    background: transparent;
    margin: auto;
    width: min(900px, calc(100vw - 32px));
  }
  dialog::backdrop {
    background: var(--scrim, #0006);
  }
  .box {
    background: var(--panel);
    color: var(--ink);
    border-radius: 20px;
    box-shadow: var(--pop);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px 14px 24px;
    border-bottom: 1px solid var(--line);
  }
  .head .small {
    margin-left: auto;
  }
  .head .ib {
    width: 32px;
    height: 32px;
    border: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 26px;
    padding: 20px 24px 26px;
    max-height: 70vh;
    overflow-y: auto;
  }
  .group {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--faint);
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 32px;
    font-size: 13.5px;
    font-weight: 600;
  }
  .keys {
    display: flex;
    gap: 4px;
    flex: none;
  }
</style>
