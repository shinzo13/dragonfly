<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import LogOut from "@lucide/svelte/icons/log-out";
  import Search from "@lucide/svelte/icons/search";
  import { logout } from "#lib/api/client.js";
  import { isActive, NAV, type NavItem } from "#lib/nav.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let {
    collapsed = false,
    onnavigate,
  }: { collapsed?: boolean; onnavigate?: () => void } = $props();

  let query = $state("");
  let opened = $state<Record<string, boolean>>({});

  const pathname = $derived(page.url.pathname);

  function isOpen(item: NavItem) {
    return opened[item.label] ?? isActive(item, pathname);
  }

  function toggle(item: NavItem) {
    opened[item.label] = !isOpen(item);
  }

  function search(event: SubmitEvent) {
    event.preventDefault();
    goto(`/search?search=${encodeURIComponent(query)}`);
    onnavigate?.();
  }
</script>

<nav
  aria-label="Main"
  class="flex h-full flex-col gap-3 overflow-y-auto px-2 py-3"
>
  {#if !collapsed}
    <search>
      <form class="relative px-1" onsubmit={search}>
        <Search
          class="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-cladd-fg-softer"
        />
        <input
          class="cladd-cut cladd-focusable-input h-8 w-full rounded-cladd-md pr-2 pl-8 text-[13px] text-cladd-fg placeholder:text-cladd-fg-softer"
          id="sidebar-search"
          name="search"
          placeholder="Search..."
          type="search"
          bind:value={query}
        >
      </form>
    </search>
  {/if}

  {#each NAV as section, index (index)}
    <div class="flex flex-col gap-px">
      {#if section.title && !collapsed}
        <div
          class="px-2.5 pt-1 pb-1 font-semibold text-[10.5px] text-cladd-fg-softer uppercase tracking-[0.08em]"
        >
          {section.title}
        </div>
      {/if}
      {#each section.items as item (item.label)}
        {@const active = isActive(item, pathname)}
        {#if item.children}
          <button
            aria-expanded={isOpen(item)}
            class="group flex h-8 w-full items-center gap-2.5 rounded-cladd-sm px-2.5 text-left text-cladd-fg hover:bg-cladd-surface-next {active
              ? "font-semibold"
              : ""}"
            onclick={() => (collapsed ? goto(item.href) : toggle(item))}
            title={collapsed ? item.label : undefined}
            type="button"
          >
            <item.icon
              class="size-4 shrink-0 {active
                ? "text-brand dark:text-(--ff-series-1)"
                : "text-cladd-fg-soft"}"
            />
            {#if !collapsed}
              <span class="flex-1 truncate">{item.label}</span>
              <ChevronRight
                class="size-3.5 text-cladd-fg-softer transition-transform {isOpen(
                  item
                )
                  ? "rotate-90"
                  : ""}"
              />
            {/if}
          </button>
          {#if isOpen(item) && !collapsed}
            <div
              class="mb-1 ml-[1.15rem] flex flex-col gap-px border-cladd-outline border-l pl-2"
            >
              {#each item.children as child (child.href)}
                {@const childActive = isActive(child, pathname)}
                <a
                  aria-current={childActive ? "page" : undefined}
                  class="flex h-7 items-center justify-between gap-2 rounded-cladd-sm px-2.5 text-[13px] hover:bg-cladd-surface-next {childActive
                    ? "bg-cladd-surface-next font-semibold text-cladd-fg"
                    : "text-cladd-fg-soft"}"
                  data-sveltekit-reload={child.old ? "" : undefined}
                  href={child.href}
                  onclick={onnavigate}
                >
                  <span class="truncate">{child.label}</span>
                </a>
              {/each}
            </div>
          {/if}
        {:else}
          <a
            aria-current={active ? "page" : undefined}
            class="flex h-8 items-center gap-2.5 rounded-cladd-sm px-2.5 hover:bg-cladd-surface-next {active
              ? "bg-cladd-surface-next font-semibold text-cladd-fg"
              : "text-cladd-fg"}"
            data-sveltekit-reload={item.old ? "" : undefined}
            href={item.href}
            onclick={onnavigate}
            title={collapsed ? item.label : undefined}
          >
            <item.icon
              class="size-4 shrink-0 {active
                ? "text-brand dark:text-(--ff-series-1)"
                : "text-cladd-fg-soft"}"
            />
            {#if !collapsed}
              <span class="truncate">{item.label}</span>
            {/if}
          </a>
        {/if}
      {/each}
    </div>
  {/each}

  <button
    class="mt-auto flex h-8 items-center gap-2.5 rounded-cladd-sm px-2.5 text-left text-cladd-fg-soft hover:bg-cladd-surface-next"
    onclick={logout}
    title={collapsed ? "Logout" : undefined}
    type="button"
  >
    <LogOut class="size-4 shrink-0" />
    {#if !collapsed}
      <span>Logout</span>
    {/if}
  </button>
</nav>
