<script lang="ts">
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { page } from "$app/state";

  const NOT_FOUND = 404;

  const missing = $derived(page.status === NOT_FOUND);

  $effect(() => {
    if (missing) {
      location.replace(oldUiUrl(page.url.href));
    }
  });
</script>

{#if missing}
  <p class="p-6 text-cladd-fg-soft">Opening this page in the old interface</p>
{:else}
  <div class="flex flex-col gap-2 p-6">
    <h1 class="font-semibold text-[18px]">Something went wrong</h1>
    <p class="text-cladd-fg-soft">{page.error?.message}</p>
    <a
      class="text-brand underline"
      data-sveltekit-reload
      href={oldUiUrl(page.url.href)}
      >Open this page in the old interface</a
    >
  </div>
{/if}
