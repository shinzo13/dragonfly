<script lang="ts">
  import Logo from "#lib/v2/components/Logo.svelte";
  import "./layout.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import { ModeWatcher } from "mode-watcher";
  import { onMount, untrack } from "svelte";
  import { queryClient } from "#lib/api/lists.js";
  import { keys } from "#lib/keys.svelte.js";
  import { period, rangeFromUrl } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { ui } from "#lib/ui.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let { children } = $props();

  let lastHref = "";

  onMount(async () => {
    try {
      const back = await session.boot();
      if (back) {
        await goto(back, { replace: true });
      }
      period.init(session.viewRange, page.url);
      ui.quickEntry = page.url.searchParams.has("quick");
      period.loadFirst().catch(() => undefined);
    } catch (error) {
      session.failed = error instanceof Error ? error.message : String(error);
    }
  });

  $effect(() => {
    if (!period.ready) {
      return;
    }
    const { url } = page;
    const { start, end } = period;
    untrack(() => {
      const fromUrl = rangeFromUrl(url);
      if (url.href !== lastHref && fromUrl) {
        lastHref = url.href;
        period.set(fromUrl);
        return;
      }
      lastHref = url.href;
      const clean = !(
        url.searchParams.has("ffui") || url.searchParams.has("quick")
      );
      if (clean && fromUrl?.start === start && fromUrl?.end === end) {
        return;
      }
      const next = new URL(url.href);
      next.searchParams.delete("ffui");
      next.searchParams.delete("quick");
      next.searchParams.set("start", start);
      next.searchParams.set("end", end);
      lastHref = next.href;
      goto(next, { replace: true, shallow: true, state: page.state });
    });
  });
</script>

<ModeWatcher />
<svelte:window onkeydown={keys.handle} />

<QueryClientProvider client={queryClient}>
  {#if session.ready && period.ready}
    {@render children()}
  {:else if session.failed}
    <main class="grid min-h-dvh place-items-center p-6 text-center">
      <div class="flex max-w-md flex-col gap-3">
        <h1 class="font-semibold text-[18px]">Firefly III did not answer</h1>
        <p class="text-cladd-fg-soft">{session.failed}</p>
        <p class="flex justify-center gap-4">
          <a class="text-brand underline" href={page.url.pathname}>Try again</a>
          <a class="text-brand underline" data-sveltekit-reload href="/login"
            >Log in</a
          >
          <a
            class="text-brand underline"
            data-sveltekit-reload
            href={`${page.url.pathname}?ffui=old`}
            >Open the old interface</a
          >
        </p>
      </div>
    </main>
  {:else}
    <main class="grid min-h-dvh place-items-center text-cladd-fg-soft">
      <span class="boot"><Logo size={56} /></span>
    </main>
  {/if}
</QueryClientProvider>

<style>
  .boot {
    color: #5b74ff;
    animation: breathe 1.6s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      opacity: 0.35;
      transform: translateY(-3px);
    }
  }
</style>
