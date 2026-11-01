<script lang="ts">
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import ChartPie from "@lucide/svelte/icons/chart-pie";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Handshake from "@lucide/svelte/icons/handshake";
  import History from "@lucide/svelte/icons/history";
  import House from "@lucide/svelte/icons/house";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Moon from "@lucide/svelte/icons/moon";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import Sun from "@lucide/svelte/icons/sun";
  import Wallet from "@lucide/svelte/icons/wallet";
  import { createQuery } from "@tanstack/svelte-query";
  import { mode } from "mode-watcher";
  import { display } from "#lib/money/display.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { afterNavigate, beforeNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { forms } from "../forms/forms.svelte.js";
  import { mobile } from "../mobile.svelte.js";
  import { view } from "../money.svelte.js";
  import { oldUrl } from "../paths.js";
  import { toggleTheme } from "../shell.svelte.js";
  import { sync, syncKeys } from "../sync.js";
  import Logo from "./Logo.svelte";
  import PeriodMenu from "./PeriodMenu.svelte";

  const SECTIONS = [
    { href: "/", icon: House, label: "Overview", match: (p: string) => p === "/" },
    { href: "/tx", icon: ArrowLeftRight, label: "Transactions", match: (p: string) => p.startsWith("/tx") },
    { href: "/acc", icon: Wallet, label: "Accounts", match: (p: string) => p.startsWith("/acc") },
    { href: "/debts", icon: Handshake, label: "Debts", match: (p: string) => p === "/debts" },
    { href: "/control", icon: Gauge, label: "Control", match: (p: string) => p === "/control" },
    { href: "/stats", icon: ChartPie, label: "Stats", match: (p: string) => p === "/stats" },
    { href: "/sync", icon: RefreshCw, label: "Sync", match: (p: string) => p === "/sync" },
  ];
  const TABS = SECTIONS.slice(0, 3);
  const MORE = SECTIONS.slice(3);

  const asks = createQuery(() => ({ queryFn: sync.questions, queryKey: syncKeys.questions, refetchInterval: 60_000, retry: 0 }));
  const waiting = $derived(asks.data?.length ?? 0);
  const current = $derived(SECTIONS.find((s) => s.match(page.url.pathname)) ?? SECTIONS[0]);

  let pending = $state<number | null>(null);
  const settled = $derived(mobile.menu || MORE.includes(current) ? TABS.length : TABS.indexOf(current));
  const active = $derived(pending ?? settled);
  const SPRING = "cubic-bezier(.34,1.45,.55,1)";

  let blob = $state<HTMLElement>();
  let last = -1;

  $effect(() => {
    const at = active;
    if (last >= 0 && last !== at && blob) {
      const stretch = 1 + Math.min(0.5, Math.abs(at - last) * 0.18);
      blob.animate([{ transform: "scaleX(1)" }, { transform: `scaleX(${stretch}) scaleY(.92)` }, { transform: "scaleX(1)" }], {
        duration: 420,
        easing: "ease-out",
      });
    }
    last = at;
  });

  function rank(path: string): [number, number] {
    const depth = path.split("/").filter(Boolean).length;
    const index = SECTIONS.findIndex((s) => s.match(path));
    return [depth, index];
  }

  const ENTER: Record<string, { x: number; duration: number }> = {
    next: { duration: 240, x: 18 },
    pop: { duration: 260, x: -36 },
    prev: { duration: 240, x: -18 },
    push: { duration: 280, x: 48 },
  };
  let dir = "";

  beforeNavigate((nav) => {
    const from = nav.from?.url.pathname;
    const to = nav.to?.url.pathname;
    dir = "";
    if (!(from && to) || from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const [fromDepth, fromIndex] = rank(from);
    const [toDepth, toIndex] = rank(to);
    dir = toIndex > fromIndex ? "next" : "prev";
    if (toDepth !== fromDepth) {
      dir = toDepth > fromDepth ? "push" : "pop";
    }
  });

  afterNavigate(() => {
    const enter = ENTER[dir];
    const main = document.querySelector(".v2 main");
    if (!(enter && main)) {
      return;
    }
    main.animate([{ opacity: 0, transform: `translateX(${enter.x}px)` }, { opacity: 1, transform: "none" }], {
      duration: enter.duration,
      easing: "cubic-bezier(.2,.8,.2,1)",
    });
  });

  function pop(node: HTMLElement, { out = false } = {}) {
    return {
      css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * 18}px) scale(${0.92 + t * 0.08})`,
      duration: out ? 160 : 380,
      easing: out ? cubicOut : (t: number) => 1 - (1 - t) ** 3 * Math.cos(t * 4.2),
    };
  }

  const close = () => (mobile.menu = false);

  function leave(s: (typeof SECTIONS)[number]) {
    if (current === s) {
      return;
    }
    pending = TABS.length;
    close();
  }

  function run(action: () => void) {
    close();
    action();
  }

  $effect(() => {
    page.url.pathname;
    mobile.menu = false;
    pending = null;
  });
</script>

<header class="head">
  <a aria-label="Dragonfly" class="logo" href="/"><Logo size={24} /></a>
  <span class="title">{(pending !== null && TABS[pending]) ? TABS[pending].label : current.label}</span>
  <PeriodMenu plain />
</header>

<nav class="dock">
  <span class="pill" style:--at={active} style:--spring={SPRING}><span bind:this={blob} class="blob"></span></span>
  {#each TABS as s, i (s.href)}
    <a class:on={active === i} href={s.href} data-sveltekit-keepfocus data-sveltekit-preload-code="eager" onclick={() => current !== s && (pending = i)}><s.icon size={22} /><span>{s.label}</span></a>
  {/each}
  <button class:on={active === TABS.length} onclick={() => (mobile.menu = !mobile.menu)} type="button">
    <LayoutGrid size={22} /><span>More</span>{#if waiting}<i class="dot"></i>{/if}
  </button>
</nav>

{#if mobile.toast}
  <div class="toast" transition:fly={{ duration: 260, easing: cubicOut, y: 14 }}>{mobile.toast}</div>
{/if}

{#if mobile.menu}
  <button aria-label="Close menu" class="scrim" onclick={close} in:fade={{ duration: 200 }} out:fade={{ duration: 200 }} type="button"></button>
  <div class="sheet" in:pop out:pop={{ out: true }}>
    <div class="grid">
      {#each MORE as s (s.href)}
        <a class:on={current === s} href={s.href} data-sveltekit-keepfocus data-sveltekit-preload-code="eager" onclick={() => leave(s)}>
          <s.icon size={22} />{s.label}{#if s.href === "/sync" && waiting}<i class="count">{waiting}</i>{/if}
        </a>
      {/each}
    </div>
    <div class="list">
      <button onclick={() => run(() => ui.openPalette())} type="button"><Search size={18} />Search</button>
      <button onclick={() => run(() => (forms.newTx = true))} type="button"><Plus size={18} />New transaction</button>
      <button onclick={toggleTheme} type="button">
        {#if mode.current === "dark"}<Sun size={18} />Light theme{:else}<Moon size={18} />Dark theme{/if}
      </button>
      <a data-sveltekit-reload href={oldUrl(page.url, "legacy")}><History size={18} />Old interface</a>
    </div>
    <div class="seg">
      <button class:on={view.original} onclick={() => view.chooseOriginal()} type="button">Orig</button>
      {#each display.options as c (c.code)}
        <button class:on={!view.original && c.code === view.code} onclick={() => view.choose(c.code)} type="button">{c.code}</button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .head {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 18px;
    padding-top: env(safe-area-inset-top);
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(18px) saturate(180%);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
  }
  .logo {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: linear-gradient(145deg, #7d93ff, #3b5bfd);
    color: #fff;
    flex: none;
  }
  .title {
    flex: 1;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.025em;
    white-space: nowrap;
  }
  .dock {
    position: fixed;
    left: 14px;
    right: 14px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 50;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 5px;
    border-radius: 30px;
    background: color-mix(in srgb, var(--panel) 72%, transparent);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow: 0 10px 34px -12px #00000066, inset 0 0 0 0.5px color-mix(in srgb, var(--ink) 16%, transparent);
  }
  .pill {
    position: absolute;
    top: 5px;
    bottom: 5px;
    left: 5px;
    width: calc((100% - 10px) / 4);
    transform: translateX(calc(var(--at) * 100%));
    transition: transform 0.5s var(--spring);
    pointer-events: none;
  }
  .blob {
    display: block;
    height: 100%;
    border-radius: 25px;
    background: color-mix(in srgb, var(--ink) 9%, transparent);
  }
  .dock a,
  .dock button {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    height: 54px;
    justify-content: center;
    border: 0;
    border-radius: 25px;
    background: none;
    color: var(--mute);
    font-size: 10.5px;
    font-weight: 700;
    transition: color 0.25s;
  }
  .dock :global(svg) {
    transition: transform 0.45s cubic-bezier(0.34, 1.6, 0.55, 1), fill-opacity 0.25s;
    fill: currentColor;
    fill-opacity: 0;
  }
  .dock .on {
    color: var(--acc);
  }
  .dock .on :global(svg) {
    transform: scale(1.08);
    fill-opacity: 0.18;
  }
  .dock :is(a, button):active :global(svg) {
    transform: scale(0.86);
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(92px + env(safe-area-inset-bottom));
    z-index: 60;
    translate: -50% 0;
    padding: 10px 16px;
    border-radius: 18px;
    background: color-mix(in srgb, var(--panel) 80%, transparent);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow: var(--pop);
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
  }
  .dot {
    position: absolute;
    top: 9px;
    left: calc(50% + 9px);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--warn);
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 45;
    border: 0;
    background: var(--scrim);
  }
  .sheet {
    position: fixed;
    left: 14px;
    right: 14px;
    bottom: calc(86px + env(safe-area-inset-bottom));
    z-index: 49;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    border-radius: 28px;
    background: color-mix(in srgb, var(--panel) 86%, transparent);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow: var(--pop);
    transform-origin: 85% 100%;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .grid a {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 0 12px;
    border-radius: 18px;
    background: var(--sunk);
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
  }
  .grid a.on {
    color: var(--acc);
  }
  .count {
    position: absolute;
    top: 6px;
    right: 8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--warn);
    color: #fff;
    font-size: 10.5px;
    font-style: normal;
    font-weight: 800;
    line-height: 18px;
    text-align: center;
  }
  .list {
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    background: var(--sunk);
    overflow: hidden;
  }
  .list button,
  .list a {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 46px;
    padding: 0 16px;
    border: 0;
    background: none;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
    text-align: left;
  }
  .list > * + * {
    box-shadow: inset 0 0.5px 0 var(--line);
  }
  .list :global(svg) {
    color: var(--mute);
  }
  .seg {
    display: flex;
    padding: 3px;
    border-radius: 14px;
    background: var(--sunk);
  }
  .seg button {
    flex: 1;
    height: 34px;
    border: 0;
    border-radius: 11px;
    background: none;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--mute);
  }
  .seg .on {
    background: var(--panel);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
</style>
