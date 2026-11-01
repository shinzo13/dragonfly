<script lang="ts">
  import "#lib/v2/theme.css";
  import { onMount } from "svelte";
  import MobileShell from "#lib/v2/components/MobileShell.svelte";
  import Palette from "#lib/v2/components/Palette.svelte";
  import Shortcuts from "#lib/v2/components/Shortcuts.svelte";
  import TopBar from "#lib/v2/components/TopBar.svelte";
  import TxNew from "#lib/v2/forms/TxNew.svelte";
  import { glyphs } from "#lib/v2/glyphs.svelte.js";
  import { mobile, useCopy, useMobile, useNative } from "#lib/v2/mobile.svelte.js";
  import { view } from "#lib/v2/money.svelte.js";
  import { useShellKeys } from "#lib/v2/shell.svelte.js";

  let { children } = $props();

  useShellKeys();
  useMobile();
  useNative();
  useCopy();

  onMount(() => {
    glyphs.load().catch(() => undefined);
    view.boot().catch(() => undefined);
  });
</script>

<div class="v2" class:narrow={mobile.narrow}>
  {#if mobile.narrow}
    <MobileShell />
  {:else}
    <TopBar />
  {/if}
  <main>
    {@render children()}
  </main>
  <Palette />
  <Shortcuts />
  <TxNew />
</div>

<style>
  main {
    padding: 28px 32px 48px;
    max-width: 1680px;
    margin: 0 auto;
  }
  .narrow main {
    padding: 8px 14px 110px;
  }
</style>
