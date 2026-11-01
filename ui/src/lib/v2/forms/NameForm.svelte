<script lang="ts">
  import { api } from "#lib/api/client.js";
  import { goto } from "$app/navigation";
  import Sheet from "../components/Sheet.svelte";
  import { look } from "../look.svelte.js";
  import { Saver } from "./saver.svelte.js";

  let {
    open = $bindable(false),
    kind,
    id,
    name,
  }: { open?: boolean; kind: "category" | "tag"; id: string; name: string } = $props();

  const saver = new Saver();
  let value = $state("");

  $effect(() => {
    if (open) {
      value = name;
      saver.error = "";
    }
  });

  async function save() {
    const next = value.trim();
    if (!next) {
      saver.fail("Give it a name");
      return;
    }
    const path = kind === "category" ? `/v1/categories/${id}` : `/v1/tags/${encodeURIComponent(id)}`;
    const body = kind === "category" ? { name: next } : { tag: next };
    const ok = await saver.run(() => api(path, { body, method: "PUT" }));
    if (ok !== undefined) {
      open = false;
      if (kind === "tag" && next !== id) {
        const old = look.looks[`tag:${id}`];
        if (old) {
          await look.set("tag", next, old);
          await look.reset("tag", id);
        }
        goto(`/tx?tag=${encodeURIComponent(next)}`, { replace: true });
      }
    }
  }
</script>

<Sheet
  bind:open
  busy={saver.busy}
  error={saver.error}
  full={kind === "category" ? `/categories/edit/${id}` : `/tags/edit/${encodeURIComponent(id)}`}
  onsubmit={save}
  title="Rename {kind}"
>
  <label class="f">
    <span class="small">Name</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input autofocus bind:value={value} class="field" />
  </label>
  <span class="small hint">Every transaction keeps it, only the name changes.</span>
</Sheet>
