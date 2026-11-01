<script lang="ts">
  import OldUi from "#lib/components/misc/OldUi.svelte";
  import { setQuery } from "#lib/components/misc/url.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { useKeys } from "#lib/keys.svelte.js";
  import { page } from "$app/state";
  import General from "./General.svelte";
  import HomeScreen from "./HomeScreen.svelte";
  import Layout from "./Layout.svelte";

  const TABS = [
    { key: "general", label: "General" },
    { key: "frontpage", label: "Home screen" },
    { key: "layout", label: "Layout" },
    { key: "notifications", label: "Notifications" },
  ];

  const tab = $derived(
    TABS.find((t) => t.key === page.url.searchParams.get("tab"))?.key ??
      "general"
  );

  const open = (key: string) =>
    setQuery({ tab: key === "general" ? null : key });

  useKeys(() =>
    TABS.map((t, i) => ({
      group: "Preferences",
      keys: String(i + 1),
      label: `${t.label} tab`,
      run: () => open(t.key),
    }))
  );
</script>

<PageHeader crumbs={[{ label: "Preferences" }]} title="Preferences" />

<div
  class="mb-4 flex flex-wrap gap-1 border-cladd-outline border-b"
  role="tablist"
>
  {#each TABS as t, i (t.key)}
    <button
      aria-selected={tab === t.key}
      class="-mb-px flex items-center gap-2 border-b-2 px-3 py-2 font-medium text-[13px] {tab ===
      t.key
        ? "border-brand text-cladd-fg"
        : "border-transparent text-cladd-fg-soft hover:text-cladd-fg"}"
      onclick={() => open(t.key)}
      role="tab"
      type="button"
    >
      {t.label}
      <span class="kbd">{i + 1}</span>
    </button>
  {/each}
</div>

{#if tab === "frontpage"}
  <HomeScreen />
{:else if tab === "layout"}
  <Layout />
{:else if tab === "notifications"}
  <OldUi href="/preferences?ffui=old">
    Notification settings (email, Slack, Pushover) stay in the old interface.
  </OldUi>
{:else}
  <General />
{/if}
