<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    href,
    label = "Open the old interface",
    children,
  }: { href: string; label?: string; children: Snippet } = $props();
</script>

<p class="text-[12px] text-cladd-fg-soft">
  {@render children()}
  <a class="text-brand hover:underline" data-sveltekit-reload {href}>{label}</a>
</p>
