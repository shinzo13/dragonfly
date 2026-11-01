<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import History from "@lucide/svelte/icons/history";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import Moon from "@lucide/svelte/icons/moon";
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import Sun from "@lucide/svelte/icons/sun";
  import { mode } from "mode-watcher";
  import { keys } from "#lib/keys.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { page } from "$app/state";
  import { createQuery } from "@tanstack/svelte-query";
  import { forms } from "../forms/forms.svelte.js";
  import { sync, syncKeys } from "../sync.js";
  import { view } from "../money.svelte.js";
  import { oldUrl } from "../paths.js";
  import { toggleTheme } from "../shell.svelte.js";
  import Logo from "./Logo.svelte";
  import Menu from "./Menu.svelte";
  import PeriodMenu from "./PeriodMenu.svelte";

  const TABS = [
    { href: "/", label: "Overview", match: (p: string) => p === "/" },
    { href: "/tx", label: "Transactions", match: (p: string) => p.startsWith("/tx") },
    { href: "/acc", label: "Accounts", match: (p: string) => p.startsWith("/acc") },
    { href: "/debts", label: "Debts", match: (p: string) => p === "/debts" },
    { href: "/control", label: "Control", match: (p: string) => p === "/control" },
    { href: "/stats", label: "Stats", match: (p: string) => p === "/stats" },
    { href: "/sync", label: "Sync", match: (p: string) => p === "/sync" },
  ];

  const asks = createQuery(() => ({ queryFn: sync.questions, queryKey: syncKeys.questions, refetchInterval: 60_000, retry: 0 }));
  const waiting = $derived(asks.data?.length ?? 0);

  const section = $derived.by(() => {
    const path = page.url.pathname;
    const from = page.url.searchParams.get("from");
    if (path.startsWith("/acc/") && from === "debts") {
      return "/debts";
    }
    return TABS.find((t) => t.match(path))?.href;
  });
</script>

<header class="top">
  <a aria-label="Dragonfly" class="logo" href="/" title="Dragonfly"><Logo size={25} /></a>
  <nav>
    {#each TABS as tab (tab.href)}
      <a class:on={section === tab.href} href={tab.href}>
        {tab.label}{#if tab.href === "/sync" && waiting}<span class="count">{waiting}</span>{/if}
      </a>
    {/each}
  </nav>
  <div class="sp"></div>
  <PeriodMenu />
  <button aria-label="New transaction" class="ib add" onclick={() => (forms.newTx = true)} title="New transaction  n" type="button"><Plus size={18} /></button>
  <button type="button" class="search" onclick={() => ui.openPalette()}>
    <Search size={16} />Jump to…<kbd>⌘K</kbd>
  </button>
  <Menu align="right" width={220}>
    {#snippet trigger({ toggle })}
      <button type="button" class="cur" onclick={toggle} title="Show amounts in">
        {view.original ? "Original" : view.code}<ChevronDown size={14} />
      </button>
    {/snippet}
    {#snippet children({ close })}
      <div class="label">Show amounts in</div>
      <button type="button"
        class="item"
        onclick={() => {
          view.chooseOriginal();
          close();
        }}
      >
        <span class="sym">¤</span>Original
        <span class="hint">{#if view.original}<Check size={15} />{/if}</span>
      </button>
      {#each display.options as c (c.code)}
        <button type="button"
          class="item"
          onclick={() => {
            view.choose(c.code);
            close();
          }}
        >
          <span class="sym">{c.symbol === c.code ? "" : c.symbol}</span>{c.code}
          <span class="hint">{#if !view.original && c.code === view.code}<Check size={15} />{/if}</span>
        </button>
      {/each}
    {/snippet}
  </Menu>
  <button type="button" aria-label="Toggle theme" class="ib" onclick={toggleTheme} title="Toggle theme  t">
    {#if mode.current === "dark"}<Sun size={17} />{:else}<Moon size={17} />{/if}
  </button>
  <button type="button" aria-label="Keyboard shortcuts" class="ib" onclick={() => (keys.sheetOpen = true)} title="Keyboard shortcuts  ?">
    <Keyboard size={17} />
  </button>
  <Menu align="right" width={250}>
    {#snippet trigger({ toggle })}
      <button type="button" aria-label="Open an older interface" class="ib" onclick={toggle} title="Older interfaces">
        <History size={17} />
      </button>
    {/snippet}
    {#snippet children()}
      <div class="label">Open this page in</div>
      <a class="item" data-sveltekit-reload href={oldUrl(page.url, "legacy")}>
        firefly-legacy<span class="hint"><kbd>O</kbd></span>
      </a>
      <a class="item" href={oldUrl(page.url, "haikesan")}>
        firefly-haikesan<span class="hint"><kbd>A</kbd></span>
      </a>
    {/snippet}
  </Menu>
</header>

<style>
  .top {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 32px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 40;
  }
  .logo {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: linear-gradient(145deg, #7d93ff, #3b5bfd);
    display: grid;
    place-items: center;
    color: #fff;
    margin-right: 12px;
  }
  nav {
    display: flex;
    gap: 2px;
  }
  nav a {
    font-size: 14px;
    font-weight: 600;
    color: var(--mute);
    padding: 8px 13px;
    border-radius: 10px;
    transition: background 0.15s, color 0.15s;
  }
  nav a:hover {
    color: var(--ink);
  }
  .count {
    margin-left: 6px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--warn);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    display: inline-grid;
    place-items: center;
  }
  nav a.on {
    background: var(--sunk);
    color: var(--ink);
  }
  .sp {
    flex: 1;
  }
  .add {
    background: var(--ink);
    color: var(--panel);
    border-color: var(--ink);
    margin-left: 6px;
  }
  .add:hover {
    background: var(--ink);
    color: var(--panel);
    opacity: 0.85;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 220px;
    height: 38px;
    border-radius: 11px;
    background: var(--sunk);
    padding: 0 8px 0 12px;
    color: var(--faint);
    font-size: 14px;
    font-weight: 500;
    border: 0;
    cursor: pointer;
    margin-left: 6px;
  }
  .search kbd {
    margin-left: auto;
  }
  .cur {
    height: 38px;
    padding: 0 12px;
    border-radius: 11px;
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    background: var(--panel);
    cursor: pointer;
  }
  .cur:hover {
    background: var(--sunk);
  }
  .sym {
    width: 22px;
    flex: none;
    color: var(--mute);
  }
</style>
