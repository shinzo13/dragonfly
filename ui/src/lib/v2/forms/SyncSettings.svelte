<script lang="ts">
  import { useQueryClient } from "@tanstack/svelte-query";
  import Sheet from "../components/Sheet.svelte";
  import { type SyncPlugin, sync, syncKeys } from "../sync.js";

  let { open = $bindable(false), plugin }: { open?: boolean; plugin: SyncPlugin } = $props();

  const client = useQueryClient();
  let values = $state<Record<string, string | boolean>>({});
  let busy = $state(false);
  let error = $state("");

  $effect(() => {
    if (open) {
      values = Object.fromEntries(
        plugin.settings.map((s) => [s.key, s.type === "secret" ? "" : s.type === "bool" ? Boolean(s.value) : String(s.value ?? "")])
      );
      error = "";
    }
  });

  async function save() {
    const out: Record<string, unknown> = {};
    for (const s of plugin.settings) {
      const v = values[s.key];
      if (s.type === "secret" && !v) {
        if (s.required && !s.set) {
          error = `${s.label} is required`;
          return;
        }
        continue;
      }
      out[s.key] = s.type === "number" ? Number(v) : v;
    }
    busy = true;
    error = "";
    try {
      await sync.saveSettings(plugin.id, out);
      await client.invalidateQueries({ queryKey: syncKeys.plugins });
      open = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<Sheet bind:open {busy} {error} onsubmit={save} title="{plugin.name} settings">
  {#each plugin.settings as s (s.key)}
    {#if s.type === "bool"}
      <label class="check"><input bind:checked={values[s.key] as boolean} type="checkbox" />{s.label}</label>
    {:else}
      <label class="f">
        <span class="small">{s.label}{#if s.required}&nbsp;·&nbsp;<span class="hint">required</span>{/if}</span>
        <input
          bind:value={values[s.key]}
          class="field"
          placeholder={s.type === "secret" ? (s.set ? "saved, type to replace" : "not set") : ""}
          type={s.type === "secret" ? "password" : s.type === "number" ? "number" : "text"}
        />
      </label>
    {/if}
  {:else}
    <p class="small">This plugin has nothing to set up.</p>
  {/each}
  <span class="small hint">Secrets are stored by the sync service and never shown again.</span>
</Sheet>
