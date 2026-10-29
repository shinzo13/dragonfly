<script lang="ts">
  import { invalidate } from "#lib/api/lists.js";
  import type { Item, Tag } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { SELECT_CLASS } from "#lib/components/categories/form.js";
  import { Button } from "#lib/components/ui/button/index.js";
  import { mergeTag, sequence } from "./actions.js";

  let {
    clusters,
    counts,
  }: { clusters: Item<Tag>[][]; counts: Map<string, number> } = $props();

  let targets = $state<Record<string, string>>({});
  let status = $state<Record<string, string>>({});
  let busy = $state(false);

  const keyOf = (cluster: Item<Tag>[]) => cluster.map((t) => t.id).join(",");

  function best(cluster: Item<Tag>[]) {
    return [...cluster].sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        Number(a.attributes.tag !== a.attributes.tag.toLowerCase()) -
          Number(b.attributes.tag !== b.attributes.tag.toLowerCase())
    )[0];
  }

  const targetOf = (cluster: Item<Tag>[]) =>
    targets[keyOf(cluster)] ?? best(cluster).id;

  async function merge(cluster: Item<Tag>[]) {
    const key = keyOf(cluster);
    const into = cluster.find((t) => t.id === targetOf(cluster));
    if (!into || busy) {
      return;
    }
    busy = true;
    const errors: string[] = [];
    await sequence(
      cluster.filter((t) => t.id !== into.id),
      async (tag) => {
        status[key] = `Merging ${tag.attributes.tag}`;
        const outcome = await mergeTag(tag, into.attributes.tag, (o) => {
          status[key] =
            `Merging ${tag.attributes.tag}: ${o.done} of ${o.total}`;
        }).catch((failure: unknown) => ({ errors: [String(failure)] }));
        errors.push(...outcome.errors);
      }
    );
    status[key] =
      errors.length > 0 ? `${errors.length} failed: ${errors[0]}` : "Merged";
    busy = false;
    await invalidate();
  }
</script>

<Box body="p-0" title="Possible duplicates">
  {#if clusters.length === 0}
    <p class="px-3 py-2 text-[12px] text-cladd-fg-soft">No tags look alike.</p>
  {/if}
  <ul class="divide-y divide-cladd-outline text-[13px]">
    {#each clusters as cluster (keyOf(cluster))}
      {@const key = keyOf(cluster)}
      {@const target = targetOf(cluster)}
      <li class="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
        <span class="flex flex-wrap gap-x-3">
          {#each cluster as tag (tag.id)}
            <a class="hover:underline" href="/tags/show/{tag.id}">
              <span class={tag.id === target ? "font-semibold" : ""}
                >{tag.attributes.tag}</span
              >
              <span class="num text-[12px] text-cladd-fg-soft"
                >{counts.get(tag.id) ?? ""}</span
              >
            </a>
          {/each}
        </span>
        <span class="ml-auto flex items-center gap-2">
          <label class="text-[12px] text-cladd-fg-soft" for="into-{key}"
            >Keep</label
          >
          <select
            class="{SELECT_CLASS} h-7 w-48"
            id="into-{key}"
            onchange={(event) => (targets[key] = event.currentTarget.value)}
            value={target}
          >
            {#each cluster as tag (tag.id)}
              <option value={tag.id}>{tag.attributes.tag}</option>
            {/each}
          </select>
          <Button
            disabled={busy}
            onclick={() => merge(cluster)}
            size="sm"
            variant="outline"
          >
            Merge {cluster.length - 1} into it
          </Button>
        </span>
        {#if status[key]}
          <span
            class="basis-full text-right text-[12px] {status[key].includes(
              "failed"
            )
              ? "text-expense"
              : "text-cladd-fg-soft"}"
            >{status[key]}</span
          >
        {/if}
      </li>
    {/each}
  </ul>
</Box>
