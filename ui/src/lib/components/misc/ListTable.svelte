<script generics="T" lang="ts">
  import { ContextMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import ContextMenuContent from "#lib/components/ui/context-menu/context-menu-content.svelte";
  import type { ListNav } from "#lib/list-nav.svelte.js";

  let {
    nav,
    key,
    head,
    row,
    menu,
    empty = "Nothing here yet",
    class: className = "",
  }: {
    nav: ListNav<T>;
    key: (item: T) => string;
    head: Snippet;
    row: Snippet<[T, number]>;
    menu?: Snippet<[T]>;
    empty?: string;
    class?: string;
  } = $props();
</script>

{#snippet rows()}
  {#each nav.items as item, i (key(item))}
    <tr
      class="h-7 border-cladd-outline/60 border-b last:border-b-0 {nav.cursor ===
      i
        ? "bg-row-cursor"
        : "hover:bg-row-hover"}"
      id={nav.rowId(i)}
      onclick={(event) => nav.click(i, event)}
      oncontextmenu={() => (nav.cursor = i)}
    >
      {@render row(item, i)}
    </tr>
  {:else}
    <tr>
      <td class="px-2 py-3 text-cladd-fg-soft" colspan="99">{empty}</td>
    </tr>
  {/each}
{/snippet}

<div class="overflow-x-auto">
  <table class="w-full border-collapse text-[13px] {className}">
    <thead>
      <tr>
        {@render head()}
      </tr>
    </thead>
    {#if menu}
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          {#snippet child({
            props,
          })}
            <tbody {...props}>
              {@render rows()}
            </tbody>
          {/snippet}
        </ContextMenu.Trigger>
        <ContextMenuContent class="w-56">
          {#if nav.current}
            {@render menu(nav.current)}
          {/if}
        </ContextMenuContent>
      </ContextMenu.Root>
    {:else}
      <tbody>
        {@render rows()}
      </tbody>
    {/if}
  </table>
</div>
