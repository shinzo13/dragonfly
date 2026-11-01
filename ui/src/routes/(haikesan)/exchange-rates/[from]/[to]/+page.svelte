<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { api } from "#lib/api/client.js";
  import { all, invalidate } from "#lib/api/lists.js";
  import type { ExchangeRate, Item } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import LineChart from "#lib/components/charts/LineChart.svelte";
  import {
    Action,
    Arm,
    errorText,
  } from "#lib/components/misc/action.svelte.js";
  import Field from "#lib/components/misc/Field.svelte";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import MenuDelete from "#lib/components/misc/MenuDelete.svelte";
  import Status from "#lib/components/misc/Status.svelte";
  import { muted, td, tdNum, th, thNum } from "#lib/components/misc/styles.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import Button from "#lib/components/ui/button/button.svelte";
  import ContextMenuItem from "#lib/components/ui/context-menu/context-menu-item.svelte";
  import Input from "#lib/components/ui/input/input.svelte";
  import { parse, today } from "#lib/dates.js";
  import {
    currentLocale,
    formatDate,
    formatNumber,
    toNumber,
  } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { page } from "$app/state";

  interface Row {
    backward?: Item<ExchangeRate>;
    date: string;
    forward?: Item<ExchangeRate>;
  }

  const DIGITS = 6;
  const monthLabel = new Intl.DateTimeFormat(currentLocale(), {
    month: "short",
    year: "numeric",
  });

  const from = $derived((page.params.from ?? "").toUpperCase());
  const to = $derived((page.params.to ?? "").toUpperCase());

  const query = createQuery(() => ({
    queryFn: () => all<ExchangeRate>(`/v1/exchange-rates/${from}/${to}`),
    queryKey: ["exchange-rates", from, to],
  }));

  const rows = $derived.by(() => {
    const map = new Map<string, Row>();
    for (const item of query.data ?? []) {
      const date = (item.attributes.date ?? "").slice(0, 10);
      const row = map.get(date) ?? { date };
      if (item.attributes.from_currency_code === from) {
        row.forward = item;
      } else {
        row.backward = item;
      }
      map.set(date, row);
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  });

  const value = (item?: Item<ExchangeRate>) =>
    item ? toNumber(item.attributes.rate) : null;
  const invert = (n: number | null) => (n ? 1 / n : null);
  const forwardOf = (row: Row) =>
    value(row.forward) ?? invert(value(row.backward));
  const backwardOf = (row: Row) =>
    value(row.backward) ?? invert(value(row.forward));
  const show = (n: number | null) =>
    n === null ? "" : formatNumber(n, DIGITS);

  const series = $derived([
    {
      format: (n: number) => formatNumber(n, DIGITS),
      key: "rate",
      label: `${from} → ${to}`,
      points: [...rows]
        .reverse()
        .map((row) => ({ x: row.date, y: forwardOf(row) ?? 0 })),
    },
  ]);

  let editing = $state<string | null>(null);
  const draft = $state({ backward: "", forward: "" });
  const rowAction = new Action();
  const arm = new Arm();
  const removal = new Action();

  async function edit(row: Row) {
    editing = row.date;
    draft.forward = row.forward?.attributes.rate ?? "";
    draft.backward = row.backward?.attributes.rate ?? "";
    rowAction.reset();
    await tick();
    document.getElementById("rate-forward")?.focus();
  }

  const clean = (text: string) => text.trim().replace(",", ".");

  function store(
    item: Item<ExchangeRate> | undefined,
    pair: string[],
    date: string,
    text: string
  ) {
    const rate = clean(text);
    if (item && !rate) {
      return api(`/v1/exchange-rates/${item.id}`, { method: "DELETE" });
    }
    if (item && toNumber(rate) !== toNumber(item.attributes.rate)) {
      return api(`/v1/exchange-rates/${item.id}`, {
        body: { rate },
        method: "PUT",
      });
    }
    if (!item && rate) {
      return api("/v1/exchange-rates", {
        body: { date, from: pair[0], rate, to: pair[1] },
        method: "POST",
      });
    }
  }

  async function save(event: SubmitEvent, row: Row) {
    event.preventDefault();
    const ok = await rowAction.run(async () => {
      await store(row.forward, [from, to], row.date, draft.forward);
      await store(row.backward, [to, from], row.date, draft.backward);
      await invalidate();
    });
    if (ok) {
      editing = null;
    }
  }

  async function remove(row: Row) {
    const ids = [row.forward?.id, row.backward?.id].filter(Boolean);
    const ok = await removal.run(async () => {
      await Promise.all(
        ids.map((id) => api(`/v1/exchange-rates/${id}`, { method: "DELETE" }))
      );
      await invalidate();
    }, "Deleted");
    if (ok && editing === row.date) {
      editing = null;
    }
  }

  function cancel(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      editing = null;
    }
  }

  const add = $state({ date: today(), rate: "" });
  const adding = new Action();

  async function create(event: SubmitEvent) {
    event.preventDefault();
    const ok = await adding.run(async () => {
      await api("/v1/exchange-rates", {
        body: { date: add.date, from, rate: clean(add.rate), to },
        method: "POST",
      });
      await invalidate();
    });
    if (ok) {
      add.rate = "";
    }
  }

  const nav: ListNav<Row> = new ListNav({
    edit,
    extra: () => [
      {
        group: "Exchange rates",
        keys: "D",
        label: "Delete rates of this date (press twice)",
        run: () => {
          const row = nav.current;
          if (row) {
            arm.press(row.date, () => remove(row));
          }
        },
      },
      {
        group: "Exchange rates",
        keys: "c",
        label: "Add a new exchange rate",
        run: () => document.getElementById("new-rate-date")?.focus(),
      },
    ],
    id: "rates",
    items: () => rows,
    key: (row) => row.date,
    open: edit,
  });
  nav.use();
</script>

<PageHeader
  crumbs={[
    { href: "/exchange-rates", label: "Exchange rates" },
    { label: `${from} → ${to}` },
  ]}
  title="Exchange rates"
/>

<div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
  <div class="flex min-w-0 flex-col gap-4">
    {#if rows.length > 1}
      <Box title="{from} → {to}">
        <LineChart
          axisFormat={(n) => formatNumber(n, 4)}
          height={200}
          label="Exchange rate {from} to {to} by date"
          {series}
          toggle={false}
          xFormat={(day) => monthLabel.format(parse(day))}
        />
      </Box>
    {/if}
    <Box body="p-0" title="Table with exchange rates">
      {#snippet tools()}
        <Status action={removal} busy="Deleting" />
      {/snippet}
      {#if query.isPending}
        <p class="p-3 {muted}">Loading exchange rates</p>
      {:else if query.error}
        <p class="p-3 text-expense">{errorText(query.error)}</p>
      {:else}
        <ListTable
          empty="There are no exchange rates between {from} and {to} yet."
          key={(row) => row.date}
          {nav}
        >
          {#snippet head()}
            <th class="{th} w-36">Date</th>
            <th class="{thNum} w-44">{from} → {to}</th>
            <th class="{thNum} w-44">{to} → {from}</th>
            <th class={th}></th>
          {/snippet}
          {#snippet row(
            row
          )}
            {#if editing === row.date}
              <td class="{td} num">{formatDate(row.date)}</td>
              <td class={td} colspan="3">
                <form
                  class="flex flex-wrap items-center gap-2"
                  onsubmit={(event) => save(event, row)}
                >
                  <Input
                    aria-label="{from} → {to}"
                    class="num h-7 w-40 text-right"
                    id="rate-forward"
                    inputmode="decimal"
                    onkeydown={cancel}
                    placeholder={show(forwardOf(row))}
                    bind:value={draft.forward}
                  />
                  <Input
                    aria-label="{to} → {from}"
                    class="num h-7 w-40 text-right"
                    inputmode="decimal"
                    onkeydown={cancel}
                    placeholder={show(backwardOf(row))}
                    bind:value={draft.backward}
                  />
                  <Button disabled={rowAction.busy} size="xs" type="submit"
                    >Save</Button
                  >
                  <Button
                    onclick={() => (editing = null)}
                    size="xs"
                    variant="ghost"
                    >Cancel</Button
                  >
                  <ConfirmButton onconfirm={() => remove(row)}
                    >Delete</ConfirmButton
                  >
                  <Status action={rowAction} />
                </form>
              </td>
            {:else}
              <td class="{td} num">{formatDate(row.date)}</td>
              <td class="{tdNum} {row.forward ? "" : "text-cladd-fg-soft"}">
                {show(forwardOf(row))}
              </td>
              <td class="{tdNum} {row.backward ? "" : "text-cladd-fg-soft"}">
                {show(backwardOf(row))}
              </td>
              <td class="{td} text-[12px]">
                {#if arm.key === row.date}
                  <span class="text-expense">Press D again to delete</span>
                {/if}
              </td>
            {/if}
          {/snippet}
          {#snippet menu(
            row
          )}
            <ContextMenuItem onSelect={() => edit(row)}>
              Edit
              <span class="ml-auto kbd">e</span>
            </ContextMenuItem>
            <MenuDelete {arm} id={row.date} run={() => remove(row)} />
          {/snippet}
        </ListTable>
      {/if}
    </Box>
  </div>

  <form onsubmit={create}>
    <Box title="Add a new exchange rate">
      <div class="flex flex-col gap-3">
        <Field for="new-rate-date" label="Date" problem={adding.field("date")}>
          <Input
            class="num"
            id="new-rate-date"
            required
            type="date"
            bind:value={add.date}
          />
        </Field>
        <Field
          for="new-rate"
          help="On this day, how many {to} will you get for one {from}?"
          label="Rate"
          problem={adding.field("rate")}
        >
          <Input
            class="num"
            id="new-rate"
            inputmode="decimal"
            required
            bind:value={add.rate}
          />
        </Field>
      </div>
      {#snippet footer()}
        <Button disabled={adding.busy} size="sm" type="submit"
          >Save new rate</Button
        >
        <Status action={adding} />
      {/snippet}
    </Box>
  </form>
</div>
