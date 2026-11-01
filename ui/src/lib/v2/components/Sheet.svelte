<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    title,
    full,
    busy = false,
    error = "",
    submit = "Save",
    onsubmit,
    children,
    danger,
  }: {
    open?: boolean;
    title: string;
    full?: string;
    busy?: boolean;
    error?: string;
    submit?: string;
    onsubmit: () => void;
    children: Snippet;
    danger?: Snippet;
  } = $props();

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  });

  function keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onsubmit();
    }
  }
</script>

<dialog
  bind:this={dialog}
  aria-label={title}
  onclick={(event) => event.target === dialog && (open = false)}
  onclose={() => (open = false)}
  onkeydown={keydown}
>
  {#if open}
    <form
      class="sheet"
      onsubmit={(event) => {
        event.preventDefault();
        onsubmit();
      }}
    >
      <header>
        <h1>{title}</h1>
        <button aria-label="Close" class="ib" onclick={() => (open = false)} type="button"><X size={16} /></button>
      </header>
      <div class="body">
        {@render children()}
        {#if error}<p class="error">{error}</p>{/if}
      </div>
      <footer>
        {#if full}
          <span class="small">More fields in the <a class="link" href={full}>full editor</a></span>
        {/if}
        <span class="sp"></span>
        {@render danger?.()}
        <button class="btn" onclick={() => (open = false)} type="button">Cancel</button>
        <button class="btn primary" disabled={busy} type="submit">{busy ? "Saving…" : submit}<kbd class="on-dark">⌘↵</kbd></button>
      </footer>
    </form>
  {/if}
</dialog>

<style>
  dialog {
    border: 0;
    padding: 0;
    margin: 0 0 0 auto;
    height: 100dvh;
    max-height: 100dvh;
    width: min(520px, 100vw);
    background: transparent;
    color: var(--ink);
  }
  dialog[open] {
    animation: slide 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes slide {
    from {
      transform: translateX(40px);
      opacity: 0;
    }
  }
  dialog::backdrop {
    background: var(--scrim, #0006);
  }
  .sheet {
    height: 100%;
    background: var(--panel);
    box-shadow: var(--pop);
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 18px 26px;
    border-bottom: 1px solid var(--line);
  }
  header h1 {
    font-size: 18px;
    font-weight: 800;
  }
  header .ib {
    border: 0;
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 22px 26px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px 26px;
    border-top: 1px solid var(--line);
  }
  .sp {
    flex: 1;
  }
  .on-dark {
    background: transparent;
    color: inherit;
    border-color: color-mix(in srgb, currentColor 30%, transparent);
  }
  .error {
    color: var(--neg);
    font-size: 13px;
    font-weight: 600;
  }
  .body :global(.f) {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .body :global(.f > .small) {
    font-size: 12.5px;
  }
  .body :global(.f .field) {
    width: 100%;
  }
  .body :global(.f .hint) {
    font-size: 12px;
    font-weight: 600;
    color: var(--faint);
  }
  .body :global(.pair) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .body :global(textarea.field) {
    height: auto;
    padding: 9px 12px;
    line-height: 1.5;
    resize: vertical;
  }
  .body :global(.amount) {
    font-size: 22px;
    font-weight: 800;
    height: 50px;
  }
  .body :global(.check) {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .body :global(.check input) {
    width: 18px;
    height: 18px;
    accent-color: var(--acc);
  }
</style>
