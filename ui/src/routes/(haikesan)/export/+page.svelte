<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import { createQuery } from "@tanstack/svelte-query";
  import { lists } from "#lib/api/lists.js";
  import Box from "#lib/components/Box.svelte";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import { download } from "#lib/components/misc/download.js";
  import Field from "#lib/components/misc/Field.svelte";
  import { sizeText } from "#lib/components/misc/queries.js";
  import Status from "#lib/components/misc/Status.svelte";
  import { muted } from "#lib/components/misc/styles.js";
  import { setQuery } from "#lib/components/misc/url.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import Input from "#lib/components/ui/input/input.svelte";
  import { today } from "#lib/dates.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { page } from "$app/state";

  const TYPES = [
    ["transactions", "Transactions"],
    ["accounts", "Accounts"],
    ["budgets", "Budgets"],
    ["categories", "Categories"],
    ["tags", "Tags"],
    ["bills", "Subscriptions"],
    ["piggy-banks", "Piggy banks"],
    ["recurring", "Recurring transactions"],
    ["rules", "Rules"],
  ];
  const EARLIEST = "1970-01-02";

  const params = $derived(page.url.searchParams);
  const type = $derived(
    TYPES.find(([key]) => key === params.get("type"))?.[0] ?? "transactions"
  );
  const from = $derived(params.get("from") ?? period.start);
  const to = $derived(params.get("to") ?? period.end);
  const picked = $derived(
    (params.get("accounts") ?? "").split(",").filter(Boolean)
  );

  const assets = createQuery(() => lists.accounts("asset"));
  const accounts = $derived(
    (assets.data ?? []).filter((a) => a.attributes.active !== false)
  );

  function toggle(id: string) {
    const next = picked.includes(id)
      ? picked.filter((p) => p !== id)
      : [...picked, id];
    setQuery({ accounts: next.join(",") });
  }

  const action = new Action();
  let element: HTMLFormElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    let size = 0;
    const ok = await action.run(async () => {
      if (from >= to) {
        throw new Error("The start date must be before the end date");
      }
      size = await download(
        `/v1/data/export/${type}`,
        { accounts: picked.join(","), end: to, start: from, type: "csv" },
        `${type}-export.csv`
      );
    });
    if (ok) {
      action.message = `Downloaded ${sizeText(size)}`;
    }
  }

  useKeys(() => [
    {
      group: "Export",
      input: true,
      keys: "mod+Enter",
      label: "Export",
      run: () => element?.requestSubmit(),
    },
  ]);
</script>

<PageHeader
  crumbs={[{ label: "Export data from Firefly III" }]}
  title="Export data from Firefly III"
/>

<form class="max-w-4xl" onsubmit={submit} bind:this={element}>
  <Box title="Export data from Firefly III">
    <div class="flex flex-col gap-4">
      <Field label="Type of export">
        <div class="grid gap-1.5 pt-1.5 sm:grid-cols-3">
          {#each TYPES as [key, label] (key)}
            <label class="flex items-center gap-2">
              <input
                checked={type === key}
                class="size-3.5 accent-brand"
                name="type"
                onchange={() => setQuery({ type: key })}
                type="radio"
                value={key}
              >
              {label}
            </label>
          {/each}
        </div>
      </Field>
      <Field label="Date range">
        <div class="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Start date"
            class="num w-40"
            onchange={(event) => setQuery({ from: event.currentTarget.value })}
            type="date"
            value={from}
          />
          <span class="text-cladd-fg-soft">to</span>
          <Input
            aria-label="End date"
            class="num w-40"
            onchange={(event) => setQuery({ to: event.currentTarget.value })}
            type="date"
            value={to}
          />
          <Button
            onclick={() => setQuery({ from: null, to: null })}
            size="sm"
            variant="outline"
            >This period</Button
          >
          <Button
            onclick={() => setQuery({ from: EARLIEST, to: today() })}
            size="sm"
            variant="outline"
            >Everything</Button
          >
        </div>
      </Field>
      {#if type === "transactions"}
        <Field label="Accounts">
          <div class="flex flex-col gap-1.5 pt-1.5">
            <p class={muted}>
              {picked.length === 0
                ? "Transactions from all asset accounts. Pick accounts to narrow it down."
                : `Transactions from ${picked.length} of ${accounts.length} asset accounts.`}
              {#if picked.length > 0}
                <button
                  class="text-brand hover:underline"
                  onclick={() => setQuery({ accounts: null })}
                  type="button"
                >
                  Use all
                </button>
              {/if}
            </p>
            <div class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {#each accounts as account (account.id)}
                <label class="flex min-w-0 items-center gap-2">
                  <input
                    checked={picked.includes(account.id)}
                    class="size-3.5 accent-brand"
                    onchange={() => toggle(account.id)}
                    type="checkbox"
                  >
                  <span class="truncate">{account.attributes.name}</span>
                </label>
              {/each}
            </div>
          </div>
        </Field>
      {/if}
    </div>
    {#snippet footer()}
      <Button disabled={action.busy} size="sm" type="submit">
        <Download />
        Export {TYPES.find(([key]) => key === type)?.[1].toLowerCase()} as CSV
      </Button>
      <Status {action} busy="Preparing the file" />
    {/snippet}
  </Box>
</form>
