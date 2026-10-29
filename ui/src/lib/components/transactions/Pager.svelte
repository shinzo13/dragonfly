<script lang="ts">
  import { useKeys } from "#lib/keys.svelte.js";
  import { goto } from "$app/navigation";

  let {
    page,
    pages,
    href,
    keys = false,
  }: {
    page: number;
    pages: number;
    href: (page: number) => string;
    keys?: boolean;
  } = $props();

  const numbers = $derived.by(() => {
    const list: (number | null)[] = [];
    for (let n = 1; n <= pages; n += 1) {
      if (n === 1 || n === pages || Math.abs(n - page) <= 2) {
        list.push(n);
      } else if (list.at(-1) !== null) {
        list.push(null);
      }
    }
    return list;
  });

  function go(target: number) {
    if (target >= 1 && target <= pages && target !== page) {
      goto(href(target), { reset: false });
    }
  }

  useKeys(() =>
    keys
      ? [
          {
            group: "List",
            keys: ">",
            label: "Next page",
            run: () => go(page + 1),
          },
          {
            group: "List",
            keys: "<",
            label: "Previous page",
            run: () => go(page - 1),
          },
        ]
      : []
  );
</script>

{#if pages > 1}
  <nav
    aria-label="Pages"
    class="flex items-center gap-0.5 text-[12px]"
    data-sveltekit-reset="false"
  >
    {#if page > 1}
      <a
        class="rounded-cladd-sm px-2 py-1 text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg"
        href={href(page - 1)}
        rel="prev"
        title="Previous page  <"
        >Previous</a
      >
    {/if}
    {#each numbers as n, i (n ?? `gap-${i}`)}
      {#if n === null}
        <span class="px-1 text-cladd-fg-softer">...</span>
      {:else if n === page}
        <span
          aria-current="page"
          class="num rounded-cladd-sm bg-row-selected px-2 py-1 font-semibold text-cladd-fg"
          >{n}</span
        >
      {:else}
        <a
          class="num rounded-cladd-sm px-2 py-1 text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg"
          href={href(n)}
          >{n}</a
        >
      {/if}
    {/each}
    {#if page < pages}
      <a
        class="rounded-cladd-sm px-2 py-1 text-cladd-fg-soft hover:bg-row-hover hover:text-cladd-fg"
        href={href(page + 1)}
        rel="next"
        title="Next page  >"
        >Next</a
      >
    {/if}
  </nav>
{/if}
