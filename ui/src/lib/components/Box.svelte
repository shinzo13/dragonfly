<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    href,
    tools,
    footer,
    children,
    class: className = "",
    body = "p-3",
  }: {
    title?: string;
    href?: string;
    tools?: Snippet;
    footer?: Snippet;
    children: Snippet;
    class?: string;
    body?: string;
  } = $props();
</script>

<section
  class="cladd-surface cladd-outline flex min-w-0 flex-col rounded-cladd-lg {className}"
>
  {#if title || tools}
    <header
      class="flex min-h-10 items-center justify-between gap-3 border-cladd-outline border-b px-3 py-1.5"
    >
      {#if title}
        <h2 class="truncate font-semibold text-[13px] text-cladd-fg">
          {#if href}
            <a class="hover:underline" {href}>{title}</a>
          {:else}
            {title}
          {/if}
        </h2>
      {/if}
      {#if tools}
        <div class="flex shrink-0 items-center gap-1.5">{@render tools()}</div>
      {/if}
    </header>
  {/if}
  <div class="min-h-0 flex-1 {body}">
    {@render children()}
  </div>
  {#if footer}
    <footer
      class="flex items-center gap-2 border-cladd-outline border-t px-3 py-2 text-[12px]"
    >
      {@render footer()}
    </footer>
  {/if}
</section>
