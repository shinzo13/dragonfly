<script lang="ts">
  import type { Snippet } from "svelte";

  const ARM_MS = 3000;

  let {
    onconfirm,
    children,
    armed = $bindable(false),
    confirmLabel = "Press again to delete",
    class: className = "",
    disabled = false,
  }: {
    onconfirm: () => void | Promise<void>;
    children: Snippet;
    armed?: boolean;
    confirmLabel?: string;
    class?: string;
    disabled?: boolean;
  } = $props();

  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  export async function press() {
    if (busy) {
      return;
    }
    if (!armed) {
      armed = true;
      clearTimeout(timer);
      timer = setTimeout(() => (armed = false), ARM_MS);
      return;
    }
    clearTimeout(timer);
    busy = true;
    try {
      await onconfirm();
    } finally {
      busy = false;
      armed = false;
    }
  }
</script>

<button
  aria-live="polite"
  class="cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-[12px] {armed
    ? "cladd-color-red text-cladd-primary"
    : "text-cladd-fg"} {className}"
  disabled={disabled || busy}
  onblur={() => (armed = false)}
  onclick={press}
  type="button"
>
  {#if armed}
    {confirmLabel}
  {:else}
    {@render children()}
  {/if}
</button>
