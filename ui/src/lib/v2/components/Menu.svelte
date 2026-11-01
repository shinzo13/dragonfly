<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    align = "left",
    width = 240,
    sheet = false,
    trigger,
    children,
  }: {
    open?: boolean;
    align?: "left" | "right";
    width?: number;
    sheet?: boolean;
    trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
    children: Snippet<[{ close: () => void }]>;
  } = $props();

  let root = $state<HTMLElement>();

  const close = () => (open = false);
  const toggle = () => (open = !open);

  function outside(event: PointerEvent) {
    if (open && root && !root.contains(event.target as Node)) {
      close();
    }
  }

  function backdrop(event: PointerEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (event.clientY < box.top || event.clientY > box.bottom) {
      close();
    }
  }

  function present(node: HTMLElement) {
    const viewport = window.visualViewport;
    const place = () => {
      if (viewport) {
        node.style.setProperty("--keyboard", `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
        node.style.setProperty("--room", `${viewport.height}px`);
      }
    };
    node.showPopover();
    place();
    viewport?.addEventListener("resize", place);
    return { destroy: () => viewport?.removeEventListener("resize", place) };
  }

  function escape(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydowncapture={escape} onpointerdown={outside} />

<div class="menu" bind:this={root}>
  {@render trigger({ open, toggle })}
  {#if open && sheet}
    <div class="pop sheet" onpointerdown={backdrop} popover="manual" role="menu" tabindex="-1" use:present>
      {@render children({ close })}
    </div>
  {:else if open}
    <div class="pop" class:right={align === "right"} style:width="{width}px" role="menu">
      {@render children({ close })}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
  }
  .pop {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 50;
    background: var(--panel);
    border-radius: 14px;
    box-shadow: var(--pop);
    padding: 6px;
    animation: pop 0.14s ease-out;
  }
  .right {
    left: auto;
    right: 0;
  }
  .sheet {
    position: fixed;
    inset: auto 10px calc(10px + max(var(--keyboard, 0px), env(safe-area-inset-bottom))) 10px;
    z-index: auto;
    display: flex;
    flex-direction: column;
    width: auto;
    max-height: min(70dvh, calc(var(--room, 100dvh) - 32px));
    margin: 0;
    padding: 10px;
    border: 0;
    border-radius: 26px;
    color: var(--ink);
    overflow: hidden;
    animation: rise 0.32s cubic-bezier(0.2, 0.9, 0.25, 1);
  }
  .sheet::backdrop {
    background: var(--scrim);
  }
  .pop.sheet :global(.item) {
    min-height: 46px;
    flex: none;
    font-size: 15px;
  }
  @keyframes rise {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  .pop :global(.item) {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 36px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: 13.5px;
    font-weight: 600;
    background: none;
    border: 0;
    cursor: pointer;
    text-align: left;
    color: var(--ink);
  }
  .pop :global(.item:hover),
  .pop :global(.item.on) {
    background: var(--sunk);
  }
  .pop :global(.item .hint) {
    margin-left: auto;
    color: var(--faint);
    font-size: 12px;
  }
  .pop :global(.sep) {
    height: 1px;
    background: var(--line);
    margin: 6px 4px;
  }
  .pop :global(.label) {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--faint);
    padding: 8px 10px 4px;
  }
</style>
