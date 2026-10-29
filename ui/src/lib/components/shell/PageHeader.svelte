<script lang="ts">
  import type { Snippet } from "svelte";

  export interface Crumb {
    href?: string;
    label: string;
  }

  let {
    title,
    subtitle,
    crumbs = [],
    actions,
  }: {
    title: string;
    subtitle?: string;
    crumbs?: Crumb[];
    actions?: Snippet;
  } = $props();
</script>

<svelte:head>
  <title>{title} · Firefly III</title>
</svelte:head>

<header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-4">
  <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
    <h1
      class="break-words font-semibold text-[22px] text-cladd-fg tracking-[-0.02em]"
    >
      {title}
    </h1>
    {#if subtitle}
      <span class="text-[13px] text-cladd-fg-soft">{subtitle}</span>
    {/if}
  </div>
  <div class="flex flex-wrap items-center gap-3">
    {@render actions?.()}
    <ol
      aria-label="Breadcrumbs"
      class="flex items-center gap-1.5 text-[12px] text-cladd-fg-soft"
    >
      <li><a class="hover:text-cladd-fg hover:underline" href="/">Home</a></li>
      {#each crumbs as crumb (crumb.label)}
        <li aria-hidden="true" class="text-cladd-fg-softest">/</li>
        <li>
          {#if crumb.href}
            <a class="hover:text-cladd-fg hover:underline" href={crumb.href}
              >{crumb.label}</a
            >
          {:else}
            <span class="text-cladd-fg">{crumb.label}</span>
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</header>
