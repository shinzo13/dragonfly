<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate, lists } from "#lib/api/lists.js";
  import {
    periodPath,
    usePeriodPath,
  } from "#lib/components/budgets/period-path.svelte.js";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import Dimension from "#lib/components/dimension/Dimension.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { DimensionModel } from "#lib/dimension/model.svelte.js";
  import { tagSpec } from "#lib/dimension/spec.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";

  const ID = /^\d+$/;

  let { param, everything = false }: { param: string; everything?: boolean } =
    $props();

  const tags = createQuery(() => lists.tags());
  const tag = $derived(
    tags.data?.find((t) =>
      ID.test(param) ? t.id === param : t.attributes.tag === param
    )
  );
  const name = $derived(tag?.attributes.tag ?? (ID.test(param) ? "" : param));
  const base = $derived(`/tags/show/${tag?.id ?? encodeURIComponent(param)}`);
  usePeriodPath(() => base);

  const model = new DimensionModel(() => ({
    everything,
    spec: tagSpec(name, tags.data ?? []),
  }));
  const other = $derived(everything ? base : `${base}/all`);
  const ancestors = $derived(
    name
      .split("/")
      .slice(0, -1)
      .map((_, i, parts) => parts.slice(0, i + 1).join("/"))
  );
  const subtitle = $derived(
    [everything ? "All time" : period.label, tag?.attributes.description]
      .filter(Boolean)
      .join(" · ")
  );

  async function remove() {
    if (!tag) {
      return;
    }
    await api(`/v1/tags/${tag.id}`, { method: "DELETE" });
    await invalidate();
    await goto("/tags");
  }

  useKeys(() => [
    ...(tag
      ? [
          {
            group: "Tag",
            keys: "E",
            label: "Edit tag",
            run: () => goto(`/tags/edit/${tag.id}`),
          },
        ]
      : []),
    {
      group: "Tag",
      keys: "A",
      label: everything ? "Show the current period" : "Show all time",
      run: () => goto(other),
    },
  ]);
</script>

<PageHeader
  crumbs={[
    { href: "/tags", label: "Tags" },
    ...ancestors.map((path) => ({
      href: `/tags/show/${encodeURIComponent(path)}`,
      label: path.slice(path.lastIndexOf("/") + 1),
    })),
    { label: name.slice(name.lastIndexOf("/") + 1) || "Tag" },
  ]}
  {subtitle}
  title={name || "Tag"}
>
  {#snippet actions()}
    <Button href={other} size="sm" title="Shift+A" variant="outline"
      >{everything ? "This period" : "All time"}</Button
    >
    {#if tag}
      <Button
        href="/tags/edit/{tag.id}"
        size="sm"
        title="Shift+E"
        variant="outline"
        >Edit</Button
      >
      <ConfirmButton onconfirm={remove}>Delete</ConfirmButton>
    {/if}
  {/snippet}
</PageHeader>

{#if tags.isError}
  <p class="pb-3 text-expense">{tags.error.message}</p>
{/if}

<Dimension
  {model}
  noun={model.dir === -1 ? "purchases" : "payments"}
  onmonth={(range) =>
    everything
      ? goto(periodPath(base, range.start, range.end))
      : period.set(range)}
/>
