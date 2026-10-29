<script lang="ts">
  import { blocks, type Inline } from "./notes.js";

  let { text }: { text: string } = $props();

  const parsed = $derived(blocks(text));
</script>

{#snippet line(
  parts: Inline[]
)}
  {#each parts as part, index (index)}
    {#if part.kind === "link"}
      <a
        class="break-all text-brand hover:underline"
        href={part.href}
        rel="noopener noreferrer nofollow"
        target="_blank"
        >{part.text}</a
      >
    {:else if part.kind === "bold"}
      <strong class="font-semibold">{part.text}</strong>
    {:else if part.kind === "code"}
      <code class="rounded-[4px] bg-cladd-surface-next px-1 text-[0.92em]"
        >{part.text}</code
      >
    {:else}
      {part.text}
    {/if}
  {/each}
{/snippet}

<div class="flex max-w-[92ch] flex-col gap-2 break-words">
  {#each parsed as block, index (index)}
    {#if block.kind === "head"}
      <p class="font-semibold">{@render line(block.line)}</p>
    {:else if block.kind === "list"}
      <svelte:element
        class="flex flex-col gap-0.5 pl-5 {block.ordered
          ? "list-decimal"
          : "list-disc"}"
        this={block.ordered ? "ol" : "ul"}
      >
        {#each block.items as item, i (i)}
          <li>{@render line(item)}</li>
        {/each}
      </svelte:element>
    {:else}
      <p>
        {#each block.lines as row, i (i)}
          {#if i > 0}
            <br>
          {/if}
          {@render line(row)}
        {/each}
      </p>
    {/if}
  {/each}
</div>
