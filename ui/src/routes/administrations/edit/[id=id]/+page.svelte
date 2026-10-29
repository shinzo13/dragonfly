<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import Box from "#lib/components/Box.svelte";
  import { Action, errorText } from "#lib/components/misc/action.svelte.js";
  import Field from "#lib/components/misc/Field.svelte";
  import { misc } from "#lib/components/misc/queries.js";
  import Status from "#lib/components/misc/Status.svelte";
  import { muted, select } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import Input from "#lib/components/ui/input/input.svelte";
  import { useKeys } from "#lib/keys.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { groupQueries } from "../../groups.js";

  const id = $derived(page.params.id ?? "");
  const query = createQuery(() => groupQueries.one(id));
  const currencies = createQuery(misc.currencies);
  const group = $derived(query.data?.data.attributes);
  const enabled = $derived(
    (currencies.data ?? [])
      .filter(
        (c) =>
          c.attributes.enabled ||
          c.attributes.code === group?.primary_currency_code
      )
      .sort((a, b) => a.attributes.name.localeCompare(b.attributes.name))
  );

  let name = $derived(group?.title ?? "");
  let code = $derived(group?.primary_currency_code ?? "");

  const save = new Action();
  let element: HTMLFormElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const ok = await save.run(() =>
      api(`/v1/user-groups/${id}`, {
        body: { primary_currency_code: code, title: name },
        method: "PUT",
      })
    );
    if (ok) {
      await Promise.all([invalidate(), session.loadCurrencies()]);
      await goto("/administrations");
    }
  }

  const title = $derived(
    group
      ? `Edit financial administration "${group.title}"`
      : "Edit financial administration"
  );

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: "Submit",
      run: () => element?.requestSubmit(),
    },
  ]);
</script>

<PageHeader
  crumbs={[
    { href: "/administrations", label: "Financial administrations" },
    { label: title },
  ]}
  subtitle={title}
  title="Financial administrations"
/>

{#if group}
  <form class="max-w-3xl" onsubmit={submit} bind:this={element}>
    <Box {title}>
      <div class="flex flex-col gap-3">
        <Field for="title" label="Title" problem={save.field("title")}>
          <Input id="title" required bind:value={name} />
        </Field>
        <Field
          for="currency"
          help="Changing the primary currency can take a while, because amounts may need to be converted."
          label="Primary currency"
          problem={save.field("primary_currency_code")}
        >
          <select class={select} id="currency" bind:value={code}>
            {#each enabled as currency (currency.id)}
              <option value={currency.attributes.code}>
                {currency.attributes.name}
                ({currency.attributes.code})
              </option>
            {/each}
          </select>
        </Field>
      </div>
      {#snippet footer()}
        <Button disabled={save.busy} size="sm" type="submit">Submit</Button>
        <Status action={save} />
      {/snippet}
    </Box>
  </form>
{:else if query.error}
  <p class="text-expense">{errorText(query.error)}</p>
{:else}
  <p class={muted}>Loading administration</p>
{/if}
