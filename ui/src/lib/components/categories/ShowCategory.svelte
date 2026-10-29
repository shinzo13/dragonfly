<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Category, One } from "#lib/api/types.js";
  import {
    periodPath,
    usePeriodPath,
  } from "#lib/components/budgets/period-path.svelte.js";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import Dimension from "#lib/components/dimension/Dimension.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import { DimensionModel } from "#lib/dimension/model.svelte.js";
  import { categorySpec } from "#lib/dimension/spec.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";

  let { id, everything = false }: { id: string; everything?: boolean } =
    $props();

  const base = $derived(`/categories/show/${id}`);
  usePeriodPath(() => base);

  const category = createQuery(() => ({
    queryFn: () => api<One<Category>>(`/v1/categories/${id}`),
    queryKey: ["category", id],
  }));
  const name = $derived(category.data?.data.attributes.name ?? "");
  const model = new DimensionModel(() => ({
    everything,
    spec: categorySpec(id),
  }));
  const other = $derived(everything ? base : `${base}/all`);

  async function remove() {
    await api(`/v1/categories/${id}`, { method: "DELETE" });
    await invalidate();
    await goto("/categories");
  }

  useKeys(() => [
    {
      group: "Category",
      keys: "E",
      label: "Edit category",
      run: () => goto(`/categories/edit/${id}`),
    },
    {
      group: "Category",
      keys: "A",
      label: everything ? "Show the current period" : "Show all time",
      run: () => goto(other),
    },
  ]);
</script>

<PageHeader
  crumbs={[
    { href: "/categories", label: "Categories" },
    { label: name || "Category" },
  ]}
  subtitle={everything ? "All time" : period.label}
  title={name || "Category"}
>
  {#snippet actions()}
    <Button href={other} size="sm" title="Shift+A" variant="outline"
      >{everything ? "This period" : "All time"}</Button
    >
    <Button
      href="/categories/edit/{id}"
      size="sm"
      title="Shift+E"
      variant="outline"
      >Edit</Button
    >
    <ConfirmButton onconfirm={remove}>Delete</ConfirmButton>
  {/snippet}
</PageHeader>

<Dimension
  {model}
  noun={model.dir === -1 ? "purchases" : "payments"}
  onmonth={(range) =>
    everything
      ? goto(periodPath(base, range.start, range.end))
      : period.set(range)}
/>
