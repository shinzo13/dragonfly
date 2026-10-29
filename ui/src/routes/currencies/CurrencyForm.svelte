<script lang="ts">
  import { untrack } from "svelte";
  import { api } from "#lib/api/client.js";
  import { invalidate } from "#lib/api/lists.js";
  import type { Currency, Item } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import Field from "#lib/components/misc/Field.svelte";
  import Status from "#lib/components/misc/Status.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import Input from "#lib/components/ui/input/input.svelte";
  import { useKeys } from "#lib/keys.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import { goto } from "$app/navigation";

  let { item }: { item?: Item<Currency> } = $props();

  const form = $state(
    untrack(() => ({
      code: item?.attributes.code ?? "",
      decimal_places: item?.attributes.decimal_places ?? 2,
      enabled: item?.attributes.enabled ?? true,
      name: item?.attributes.name ?? "",
      symbol: item?.attributes.symbol ?? "",
    }))
  );

  const save = new Action();
  const removal = new Action();
  let element: HTMLFormElement | undefined = $state();

  async function done() {
    await Promise.all([invalidate(), session.loadCurrencies()]);
    await goto("/currencies");
  }

  async function submit(event?: SubmitEvent) {
    event?.preventDefault();
    const body = { ...form, decimal_places: Number(form.decimal_places) };
    const ok = await save.run(() =>
      item
        ? api(`/v1/currencies/${item.attributes.code}`, { body, method: "PUT" })
        : api("/v1/currencies", { body, method: "POST" })
    );
    if (ok) {
      await done();
    }
  }

  async function remove() {
    if (
      item &&
      (await removal.run(
        () =>
          api(`/v1/currencies/${item.attributes.code}`, { method: "DELETE" }),
        "Deleted"
      ))
    ) {
      await done();
    }
  }

  useKeys(() => [
    {
      group: "Form",
      input: true,
      keys: "mod+Enter",
      label: item ? "Update currency" : "Store new currency",
      run: () => element?.requestSubmit(),
    },
  ]);
</script>

<form class="max-w-3xl" onsubmit={submit} bind:this={element}>
  <Box title="Mandatory fields">
    <div class="flex flex-col gap-3">
      <Field for="name" label="Name" problem={save.field("name")}>
        <Input id="name" maxlength={48} required bind:value={form.name} />
      </Field>
      <Field for="symbol" label="Symbol" problem={save.field("symbol")}>
        <Input id="symbol" maxlength={51} required bind:value={form.symbol} />
      </Field>
      <Field for="code" label="Code" problem={save.field("code")}>
        <Input
          class="num uppercase"
          id="code"
          maxlength={51}
          required
          bind:value={form.code}
        />
      </Field>
      <Field
        for="decimal_places"
        label="Number of decimals"
        problem={save.field("decimal_places")}
      >
        <Input
          class="num w-24"
          id="decimal_places"
          max={12}
          min={0}
          required
          type="number"
          bind:value={form.decimal_places}
        />
      </Field>
      {#if item}
        <Field for="enabled" label="Enabled">
          <input
            class="mt-2 size-3.5 accent-brand"
            id="enabled"
            type="checkbox"
            bind:checked={form.enabled}
          >
        </Field>
      {/if}
    </div>
    {#snippet footer()}
      <Button disabled={save.busy} size="sm" type="submit">
        {item ? "Update currency" : "Store new currency"}
      </Button>
      <Status action={save} />
      {#if item}
        <span class="ml-auto flex items-center gap-2">
          <Status action={removal} busy="Deleting" />
          <ConfirmButton onconfirm={remove}>Delete currency</ConfirmButton>
        </span>
      {/if}
    {/snippet}
  </Box>
</form>
