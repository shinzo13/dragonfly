<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Coins from "@lucide/svelte/icons/coins";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import History from "@lucide/svelte/icons/history";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import Plus from "@lucide/svelte/icons/plus";
  import { DropdownMenu } from "bits-ui";
  import { setMode, userPrefersMode } from "mode-watcher";
  import type { Snippet } from "svelte";
  import { logout } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import DropdownMenuContent from "#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte";
  import DropdownMenuItem from "#lib/components/ui/dropdown-menu/dropdown-menu-item.svelte";
  import { isEditable, keys, useKeys } from "#lib/keys.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { allLinks, CREATE_LINKS } from "#lib/nav.js";
  import { period } from "#lib/period.svelte.js";
  import { session, TESTED_VERSION } from "#lib/session.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { ui } from "#lib/ui.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Cheatsheet from "./Cheatsheet.svelte";
  import Palette from "./Palette.svelte";
  import PeriodPicker from "./PeriodPicker.svelte";
  import Sidebar from "./Sidebar.svelte";

  let { children, quick }: { children: Snippet; quick?: Snippet } = $props();

  $effect(() => {
    if (display.on) {
      display.load().catch(() => undefined);
    }
  });

  function setPreset(key: string | undefined) {
    const preset = period.presets().find((item) => item.key === key);
    if (preset) {
      period.set(preset.range);
    }
  }

  function openCustomPeriod() {
    ui.periodOpen = true;
    setTimeout(() => document.getElementById("period-start")?.focus(), 50);
  }

  function openOld(sticky = false) {
    location.assign(oldUiUrl(page.url.href, sticky));
  }

  async function togglePrivacy() {
    await session.setPreference("anonymous", !session.anonymous);
    await invalidate();
  }

  async function cycleTheme() {
    const order = ["system", "light", "dark"] as const;
    const current = userPrefersMode.current ?? "system";
    const next = order[(order.indexOf(current) + 1) % order.length];
    setMode(next);
    await session.setPreference(
      "darkMode",
      next === "system" ? "browser" : next
    );
  }

  function focusSearch() {
    const input = document.getElementById("sidebar-search");
    if (input && input.offsetParent !== null) {
      input.focus();
    } else {
      goto("/search");
    }
  }

  useKeys(() => [
    {
      group: "Global",
      input: true,
      keys: "mod+k",
      label: "Command palette",
      run: () => ui.openPalette(),
    },
    {
      group: "Global",
      keys: "?",
      label: "Keyboard shortcuts",
      run: () => (keys.sheetOpen = !keys.sheetOpen),
    },
    { group: "Global", keys: "/", label: "Search", run: focusSearch },
    {
      group: "Global",
      keys: "$",
      label: display.on
        ? "Show amounts in their own currencies"
        : `Show every amount in ${display.code}`,
      run: () => display.toggle(),
    },
    {
      group: "Global",
      keys: "H",
      label: "Back",
      run: () => history.back(),
    },
    {
      group: "Global",
      keys: "L",
      label: "Forward",
      run: () => history.forward(),
    },
    {
      group: "Global",
      keys: "n",
      label: "Quick entry",
      run: () => (ui.quickEntry = true),
    },
    {
      group: "Global",
      keys: "N",
      label: "New transaction (full editor)",
      run: () => goto("/transactions/create/withdrawal"),
    },
    {
      group: "Global",
      keys: "O",
      label: "Open this page in the old interface",
      run: () => openOld(),
    },
    {
      group: "Global",
      keys: "g O",
      label: "Stay in the old interface",
      run: () => openOld(true),
    },
    {
      group: "Global",
      keys: "\\",
      label: "Toggle sidebar",
      run: () => ui.toggleSidebar(),
    },
    {
      group: "Period",
      keys: "[",
      label: "Previous period",
      run: () => period.shift(-1),
    },
    {
      group: "Period",
      keys: "]",
      label: "Next period",
      run: () => period.shift(1),
    },
    {
      group: "Period",
      keys: ".",
      label: "Current period",
      run: () => period.reset(),
    },
    {
      group: "Period",
      keys: "p p",
      label: "Choose a period",
      run: () => (ui.periodOpen = true),
    },
    {
      group: "Period",
      keys: "p c",
      label: "Custom period: type the dates",
      run: openCustomPeriod,
    },
    ...period
      .presets()
      .filter((preset) => preset.key)
      .map((preset) => ({
        group: "Period",
        keys: `p ${preset.key}`,
        label: `Period: ${preset.label}`,
        run: () => setPreset(preset.key),
      })),
    {
      group: "Global",
      hidden: true,
      keys: "g g",
      label: "Top of page",
      run: () => window.scrollTo({ top: 0 }),
    },
    {
      group: "Global",
      hidden: true,
      keys: "G",
      label: "Bottom of page",
      run: () => window.scrollTo({ top: document.body.scrollHeight }),
    },
    {
      group: "Global",
      hidden: true,
      input: true,
      keys: "Escape",
      label: "Leave field",
      run: (event) => {
        if (ui.palette || keys.sheetOpen) {
          ui.palette = false;
          keys.sheetOpen = false;
          return;
        }
        if (isEditable(event.target)) {
          (event.target as HTMLElement).blur();
        }
        ui.mobileNav = false;
        ui.quickEntry = false;
      },
    },
    {
      group: "Settings",
      keys: "g T",
      label: "Cycle theme: system, light, dark",
      run: cycleTheme,
    },
    {
      group: "Settings",
      keys: "g P",
      label: "Toggle privacy mode",
      run: togglePrivacy,
    },
    { group: "Global", keys: "g q", label: "Logout", run: logout },
    ...allLinks()
      .filter((link) => link.keys)
      .map((link) => ({
        group: "Navigation",
        keys: link.keys as string,
        label: `Go to ${link.label.toLowerCase()}`,
        run: () => (link.old ? location.assign(link.href) : goto(link.href)),
      })),
    {
      group: "Navigation",
      keys: "g f",
      label: "Go to search",
      run: () => goto("/search"),
    },
  ]);
</script>

<div class="min-h-dvh bg-cladd-bg">
  <header
    class="sticky top-0 z-40 flex h-12 items-center bg-brand text-on-brand shadow-[0_1px_0_rgb(0_0_0/0.08)]"
  >
    <a
      class="flex h-full shrink-0 items-center gap-2 px-4 text-[17px] tracking-[-0.01em] {ui.collapsed
        ? "lg:w-14 lg:justify-center lg:px-0"
        : "lg:w-60"}"
      href="/"
    >
      {#if ui.collapsed}
        <strong class="hidden lg:inline">FF</strong>
        <span class="lg:hidden"><strong>Firefly</strong>III</span>
      {:else}
        <span><strong>Firefly</strong>III</span>
      {/if}
    </a>
    <button
      aria-label="Toggle sidebar"
      class="grid size-12 shrink-0 place-items-center hover:bg-black/10"
      onclick={() => ui.toggleSidebar()}
      title="Toggle sidebar  \"
      type="button"
    >
      <PanelLeft class="size-4" />
    </button>
    <button
      class="ml-1 hidden h-8 min-w-0 items-center gap-2 rounded-cladd-md bg-black/10 px-3 text-[13px] text-on-brand/80 hover:bg-black/15 md:flex md:w-64 xl:w-80"
      onclick={() => ui.openPalette()}
      type="button"
    >
      <span class="flex-1 truncate text-left">Jump to anything</span>
      <span class="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[11px]"
        >⌘K</span
      >
    </button>
    <div class="ml-auto flex items-center gap-1 pr-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label="Currency to show amounts in"
          class="hidden h-8 items-center gap-1 rounded-cladd-md px-2 text-[12px] font-semibold hover:bg-black/10 sm:flex {display.on
            ? "bg-black/15"
            : "text-on-brand/80"}"
          title="Show every amount in one currency  $"
        >
          <Coins class="size-4" />
          <span class="hidden sm:inline"
            >{display.on ? `≈ ${display.code}` : "All currencies"}</span
          >
        </DropdownMenu.Trigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuItem onSelect={() => display.show(null)}>
            <span class="flex-1">Each in its own currency</span>
            {#if !display.on}
              <Check class="size-3.5" />
            {/if}
          </DropdownMenuItem>
          {#each display.options as currency (currency.code)}
            <DropdownMenuItem onSelect={() => display.show(currency.code)}>
              <span class="flex-1"
                >Everything in {currency.code} ({currency.symbol})</span
              >
              {#if display.on && display.code === currency.code}
                <Check class="size-3.5" />
              {/if}
            </DropdownMenuItem>
          {/each}
          <div
            class="flex items-center gap-2 px-2 py-1.5 text-[11px] text-cladd-fg-soft"
          >
            <span class="kbd">$</span>
            switches between {display.code} and own currencies
          </div>
        </DropdownMenuContent>
      </DropdownMenu.Root>
      <button
        aria-label={session.anonymous ? "Show amounts" : "Hide amounts"}
        aria-pressed={session.anonymous}
        class="hidden size-8 place-items-center rounded-cladd-md hover:bg-black/10 sm:grid"
        onclick={togglePrivacy}
        title={session.anonymous
          ? "Amounts hidden. Show amounts"
          : "Hide amounts"}
        type="button"
      >
        {#if session.anonymous}
          <EyeOff class="size-4" />
        {:else}
          <Eye class="size-4" />
        {/if}
      </button>
      <button
        aria-label="Keyboard shortcuts"
        class="hidden size-8 place-items-center rounded-cladd-md hover:bg-black/10 sm:grid"
        onclick={() => (keys.sheetOpen = true)}
        title="Keyboard shortcuts  ?"
        type="button"
      >
        <Keyboard class="size-4" />
      </button>
      <button
        aria-label="Open this page in the old interface"
        class="hidden size-8 place-items-center rounded-cladd-md hover:bg-black/10 sm:grid"
        onclick={() => openOld()}
        title="Open this page in the old interface  Shift+O"
        type="button"
      >
        <History class="size-4" />
      </button>
      <PeriodPicker />
      <span class="hidden px-2 text-[12px] text-on-brand/85 xl:inline"
        >{session.email}</span
      >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label="Create new"
          class="grid size-8 place-items-center rounded-cladd-md hover:bg-black/10"
          title="Create new"
        >
          <Plus class="size-4" />
        </DropdownMenu.Trigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuItem onSelect={() => (ui.quickEntry = true)}>
            <span class="flex-1">Quick entry</span>
            <span class="kbd">n</span>
          </DropdownMenuItem>
          {#each CREATE_LINKS as link (link.href)}
            <DropdownMenuItem
              onSelect={() =>
                link.old ? location.assign(link.href) : goto(link.href)}
            >
              {link.label}
            </DropdownMenuItem>
          {/each}
        </DropdownMenuContent>
      </DropdownMenu.Root>
    </div>
  </header>

  <div class="flex">
    <aside
      class="fixed top-12 bottom-0 z-30 w-60 shrink-0 border-cladd-outline border-r bg-cladd-surface transition-transform lg:sticky lg:h-[calc(100dvh-3rem)] lg:translate-x-0 {ui.collapsed
        ? "lg:w-14"
        : "lg:w-60"} {ui.mobileNav ? "translate-x-0" : "-translate-x-full"}"
    >
      <Sidebar
        collapsed={ui.collapsed && !ui.mobileNav}
        onnavigate={() => (ui.mobileNav = false)}
      />
    </aside>
    {#if ui.mobileNav}
      <button
        aria-label="Close menu"
        class="fixed inset-0 top-12 z-20 bg-black/30 lg:hidden"
        onclick={() => (ui.mobileNav = false)}
        type="button"
      ></button>
    {/if}

    <div class="flex min-h-[calc(100dvh-3rem)] min-w-0 flex-1 flex-col">
      {#if ui.quickEntry && quick}
        {@render quick()}
      {/if}
      <main class="mx-auto w-full max-w-[1920px] flex-1 px-4 py-4 lg:px-6">
        {@render children()}
      </main>
      <footer
        class="flex flex-wrap items-center justify-between gap-2 border-cladd-outline border-t px-4 py-2.5 text-[12px] text-cladd-fg-soft lg:px-6"
      >
        <span>
          Firefly III {session.version}
          {#if session.drift}
            <span class="text-warn"
              >· this interface was tested with {TESTED_VERSION}, some screens
              may misbehave</span
            >
          {/if}
        </span>
        <span class="flex items-center gap-1.5"
          >Press <span class="kbd">?</span> for shortcuts,
          <span class="kbd">Shift+O</span>
          for the old interface</span
        >
      </footer>
    </div>
  </div>
</div>

<Palette />
<Cheatsheet />
