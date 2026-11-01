<script lang="ts">
  import Pencil from "@lucide/svelte/icons/pencil";
  import { look, type LookKind } from "../look.svelte.js";
  import Chip from "./Chip.svelte";
  import LookPicker from "./LookPicker.svelte";

  let {
    kind,
    id,
    name,
    role,
    size = 44,
  }: { kind: LookKind; id: string; name: string; role?: string; size?: number } = $props();

  let open = $state(false);
  const l = $derived(look.of(kind, id, name, role));
</script>

<button aria-label="Change icon and colour" class="edit" onclick={() => (open = true)} title="Change icon and colour">
  <Chip color={l.color} icon={l.icon} {size} />
  <span class="pen"><Pencil size={11} /></span>
</button>
<LookPicker bind:open {id} {kind} {name} {role} />

<style>
  .edit {
    position: relative;
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
    border-radius: 14px;
    flex: none;
  }
  .pen {
    position: absolute;
    right: -4px;
    bottom: -4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--panel);
    color: var(--ink);
    box-shadow: 0 1px 3px #00000040;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .edit:hover .pen,
  .edit:focus-visible .pen {
    opacity: 1;
  }
</style>
