<script lang="ts">
  import { keys, prettyKeys } from "#lib/keys.svelte.js";

  let dialog = $state<HTMLDialogElement>();

  const groups = $derived.by(() => {
    const map = new Map<string, { keys: string; label: string }[]>();
    const seen = new Set<string>();
    for (const binding of [...keys.all].reverse()) {
      if (binding.hidden || seen.has(binding.keys)) {
        continue;
      }
      seen.add(binding.keys);
      const group = binding.group ?? "Page";
      map.set(group, [...(map.get(group) ?? []), binding]);
    }
    return [...map.entries()].reverse();
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
  aria-label="Keyboard shortcuts"
  class="cladd-surface cladd-outline m-auto w-[min(920px,calc(100vw-2rem))] rounded-cladd-panel p-0 text-cladd-fg shadow-cladd-popover backdrop:bg-black/30"
  onclick={(event) => event.target === dialog && (keys.sheetOpen = false)}
  onclose={() => (keys.sheetOpen = false)}
  onkeydown={(event) => event.key === "?" && (keys.sheetOpen = false)}
  bind:this={dialog}
>
  <div
    class="flex items-center justify-between border-cladd-outline border-b px-5 py-3"
  >
    <h2 class="font-semibold text-[15px]">Keyboard shortcuts</h2>
    <span class="text-[12px] text-cladd-fg-soft"
      >Every shortcut is also in the palette,
      <span class="kbd">{prettyKeys("mod+k")[0]}</span></span
    >
  </div>
  <div
    class="grid max-h-[70vh] grid-cols-1 gap-x-8 gap-y-5 overflow-y-auto px-5 py-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {#each groups as [group, bindings] (group)}
      <section class="flex flex-col gap-1">
        <h3
          class="pb-1 font-semibold text-[11px] text-cladd-fg-softer uppercase tracking-[0.08em]"
        >
          {group}
        </h3>
        {#each bindings as binding (binding.keys)}
          <div class="flex h-7 items-center justify-between gap-3 text-[13px]">
            <span class="truncate">{binding.label}</span>
            <span class="flex shrink-0 gap-1">
              {#each prettyKeys(binding.keys) as key, i (i)}
                <span class="kbd">{key}</span>
              {/each}
            </span>
          </div>
        {/each}
      </section>
    {/each}
  </div>
</dialog>
