<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { all, invalidate, lists } from "#lib/api/lists.js";
  import type {
    Item,
    One,
    PiggyBank,
    PiggyBankEvent,
    TransactionGroup,
  } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import ConfirmButton from "#lib/components/ConfirmButton.svelte";
  import { tones } from "#lib/components/charts/chart.js";
  import LineChart from "#lib/components/charts/LineChart.svelte";
  import Meter from "#lib/components/charts/Meter.svelte";
  import { LINK } from "#lib/components/groups/object-groups.js";
  import MoneyEditor from "#lib/components/piggy-banks/MoneyEditor.svelte";
  import {
    type Mode,
    piggyMoney,
    rooms,
  } from "#lib/components/piggy-banks/piggy.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { buttonVariants } from "#lib/components/ui/button/button.svelte";
  import { addDays, today } from "#lib/dates.js";
  import {
    formatDate,
    formatDateTime,
    formatMoney,
    percent,
    toNumber,
  } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const MIN_DAYS = 30;
  const id = $derived(page.params.id ?? "");

  const query = createQuery(() => ({
    queryFn: () => api<One<PiggyBank>>(`/v1/piggy-banks/${id}`),
    queryKey: ["piggy-bank", id],
  }));
  const events = createQuery(() => ({
    queryFn: () => all<PiggyBankEvent>(`/v1/piggy-banks/${id}/events`),
    queryKey: ["piggy-bank", id, "events"],
  }));
  const piggies = createQuery(() => lists.piggyBanks());
  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));

  const item = $derived(query.data?.data);
  const piggy = $derived(item?.attributes);
  const room = $derived(
    rooms(piggies.data ?? [], [
      ...(assets.data ?? []),
      ...(liabilities.data ?? []),
    ])
  );
  const mode = $derived(page.url.searchParams.get("money") as Mode | null);

  const groupIds = $derived([
    ...new Set(
      (events.data ?? [])
        .map((e) => e.attributes.transaction_group_id ?? "")
        .filter(Boolean)
    ),
  ]);
  const linkedDates = createQuery(() => ({
    enabled: groupIds.length > 0,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          groupIds.map(async (group) => {
            const one = await api<One<TransactionGroup>>(
              `/v1/transactions/${group}`
            );
            return [group, one.data.attributes.transactions[0]?.date ?? ""];
          })
        )
      ),
    queryKey: ["piggy-bank", id, "event-dates", groupIds],
  }));
  const when = (e: Item<PiggyBankEvent>) =>
    linkedDates.data?.[e.attributes.transaction_group_id ?? ""] ||
    e.attributes.created_at ||
    "";

  const rate = $derived(
    piggy?.currency_code === display.code
      ? null
      : display.rate(piggy?.currency_code)
  );
  const unit = $derived(
    rate === null
      ? {
          approx: "",
          decimals: piggy?.currency_decimal_places,
          symbol: piggy?.currency_symbol,
        }
      : { ...display.target, approx: "≈" }
  );
  const chartMoney = (amount: number) => formatMoney({ ...unit, amount });

  const history = $derived(
    [...(events.data ?? [])].sort((a, b) => when(b).localeCompare(when(a)))
  );
  const points = $derived.by(() => {
    const byDay = new Map<string, number>();
    let running = 0;
    for (const entry of [...history].reverse()) {
      const day = when(entry).slice(0, 10);
      const before = addDays(day, -1);
      if (!byDay.has(before)) {
        byDay.set(before, running);
      }
      running += toNumber(entry.attributes.amount);
      byDay.set(day, running);
    }
    const [first = today()] = byDay.keys();
    const start = piggy?.start_date?.slice(0, 10) ?? first;
    const [from] = [start, first, addDays(today(), -MIN_DAYS)].sort();
    byDay.set(from, 0);
    byDay.set(today(), running);
    const scale = rate ?? 1;
    return [...byDay]
      .map(([x, y]) => ({ x, y: y * scale }))
      .sort((a, b) => a.x.localeCompare(b.x));
  });

  function setMode(next: Mode | null) {
    const url = new URL(page.url.href);
    if (next) {
      url.searchParams.set("money", next);
    } else {
      url.searchParams.delete("money");
    }
    goto(url, { replace: true });
  }

  async function remove() {
    await api(`/v1/piggy-banks/${id}`, { method: "DELETE" });
    await goto("/piggy-banks");
    await invalidate();
  }

  useKeys(() => [
    {
      group: "Piggy bank",
      keys: "e",
      label: "Edit piggy bank",
      run: () => goto(`/piggy-banks/edit/${id}`),
    },
    {
      group: "Piggy bank",
      keys: "+",
      label: "Add money",
      run: () => setMode("add"),
    },
    {
      group: "Piggy bank",
      hidden: true,
      keys: "=",
      label: "Add money",
      run: () => setMode("add"),
    },
    {
      group: "Piggy bank",
      keys: "-",
      label: "Remove money",
      run: () => setMode("remove"),
    },
  ]);

  const label = "px-3 py-1.5 align-top text-cladd-fg-soft";
  const value = "px-3 py-1.5 text-right";
  const row = "border-cladd-outline/60 border-b";
</script>

<PageHeader
  crumbs={[
    { href: "/piggy-banks", label: "Piggy banks" },
    { label: piggy?.name ?? id },
  ]}
  title={piggy?.name ?? "Piggy bank"}
>
  {#snippet actions()}
    <a
      class={buttonVariants({ size: "sm", variant: "ghost" })}
      data-sveltekit-reload
      href={oldUiUrl(`${page.url.origin}/piggy-banks/show/${id}`)}
      >Open in old UI</a
    >
    <a
      class={buttonVariants({ size: "sm", variant: "outline" })}
      href="/piggy-banks/edit/{id}"
      >Edit <span class="kbd">e</span></a
    >
    <ConfirmButton onconfirm={remove}>Delete</ConfirmButton>
  {/snippet}
</PageHeader>

{#if query.error}
  <p class="text-expense">{query.error.message}</p>
{:else if !(piggy && item)}
  <p class="text-cladd-fg-soft">Loading piggy bank</p>
{:else}
  {@const target = toNumber(piggy.target_amount)}
  <div class="grid items-start gap-3 lg:grid-cols-3">
    <div class="flex flex-col gap-3 lg:col-span-2">
      <Box title="Events">
        {#if events.isPending}
          <p class="text-cladd-fg-soft">Loading events</p>
        {:else}
          <LineChart
            area
            axisFormat={chartMoney}
            height={260}
            label="Saved over time"
            series={[
              {
                color: tones.income,
                format: (v) => `${unit.approx}${chartMoney(v)}`,
                key: "saved",
                label: "Saved so far",
                points,
              },
            ]}
            toggle={false}
            zero
          />
        {/if}
      </Box>
      {#if piggy.notes}
        <Box title="Notes">
          <p class="whitespace-pre-wrap">{piggy.notes}</p>
        </Box>
      {/if}
    </div>
    <div class="flex flex-col gap-3">
      <Box body="p-0" title="Details">
        <table class="w-full text-[13px]">
          <tbody>
            <tr class={row}>
              <td class={label}>Save on account(s)</td>
              <td class={value}>
                {#each piggy.accounts ?? [] as account, i (account.account_id)}
                  {#if i > 0}
                    ,
                  {/if}
                  <a class={LINK} href="/accounts/show/{account.account_id}"
                    >{account.name}</a
                  >
                {/each}
              </td>
            </tr>
            <tr class={row}>
              <td class={label}>Group</td>
              <td class={value}>
                {#if piggy.object_group_id}
                  <a class={LINK} href="/groups/edit/{piggy.object_group_id}"
                    >{piggy.object_group_title}</a
                  >
                {:else}
                  <span class="text-cladd-fg-softer">No group</span>
                {/if}
              </td>
            </tr>
            <tr class={row}>
              <td class={label}>Target amount</td>
              <td class="{value} num">
                {target > 0
                  ? display.text([piggyMoney(piggy, piggy.target_amount)])
                  : "No target"}
              </td>
            </tr>
            {#if (piggy.accounts ?? []).length > 1}
              {#each piggy.accounts ?? [] as account (account.account_id)}
                <tr class={row}>
                  <td class={label}>Saved so far ({account.name})</td>
                  <td class={value}>
                    <Amount
                      {...piggyMoney(piggy, account.current_amount)}
                      tone="income"
                    />
                  </td>
                </tr>
              {/each}
            {/if}
            <tr class={row}>
              <td class={label}>Saved so far</td>
              <td class={value}>
                <Amount
                  {...piggyMoney(piggy, piggy.current_amount)}
                  tone="income"
                />
              </td>
            </tr>
            {#if target > 0}
              <tr class={row}>
                <td class={label}>Left to save</td>
                <td class="{value} num">
                  {display.text([piggyMoney(piggy, piggy.left_to_save)])}
                </td>
              </tr>
            {/if}
            <tr class={row}>
              <td class={label}>Start date</td>
              <td class="{value} num">
                {formatDate(piggy.start_date) || "No start date"}
              </td>
            </tr>
            <tr class={row}>
              <td class={label}>Target date</td>
              <td class="{value} num">
                {formatDate(piggy.target_date) || "No target date"}
              </td>
            </tr>
            {#if piggy.target_date && toNumber(piggy.save_per_month) > 0}
              <tr class={row}>
                <td class={label}>Suggested monthly amount to save</td>
                <td class="{value} num">
                  {display.text([piggyMoney(piggy, piggy.save_per_month)])}
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
        {#if target > 0 &&
          piggy.percentage !== null &&
          piggy.percentage !== undefined}
          <div class="flex items-center gap-2 px-3 py-2.5">
            <Meter
              max={target}
              segments={[
                { color: tones.income, value: toNumber(piggy.current_amount) },
              ]}
            />
            <span class="num text-[12px] text-cladd-fg-soft"
              >{percent(piggy.percentage / 100)}</span
            >
          </div>
        {/if}
        {#snippet footer()}
          {#if mode}
            <MoneyEditor
              {mode}
              onclose={() => setMode(null)}
              piggy={item}
              rooms={room}
            />
          {:else}
            <button
              class={buttonVariants({ size: "sm", variant: "outline" })}
              onclick={() => setMode("add")}
              type="button"
            >
              Add money <span class="kbd">+</span>
            </button>
            <button
              class={buttonVariants({ size: "sm", variant: "outline" })}
              onclick={() => setMode("remove")}
              type="button"
            >
              Remove money <span class="kbd">-</span>
            </button>
          {/if}
        {/snippet}
      </Box>
      <Box body="p-0" title="Event history">
        {#if history.length > 0}
          <table class="w-full text-[13px]">
            <tbody>
              {#each history as entry (entry.id)}
                {@const amount = toNumber(entry.attributes.amount)}
                <tr
                  class="h-7 border-cladd-outline/60 border-b last:border-b-0"
                >
                  <td class="px-3 py-1">
                    {#if entry.attributes.transaction_group_id}
                      <a
                        class={LINK}
                        href="/transactions/show/{entry.attributes
                          .transaction_group_id}"
                        >{formatDate(when(entry))}</a
                      >
                    {:else}
                      {formatDateTime(entry.attributes.created_at)}
                    {/if}
                  </td>
                  <td
                    class="px-3 py-1 text-right {amount < 0
                      ? "text-expense"
                      : "text-income"}"
                  >
                    {amount < 0 ? "Removed" : "Added"}
                    <span class="num"
                      >{display.text([
                        piggyMoney(piggy, Math.abs(amount)),
                      ])}</span
                    >
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="px-3 py-3 text-cladd-fg-soft">
            {events.isPending ? "Loading events" : "No events yet."}
          </p>
        {/if}
      </Box>
    </div>
  </div>
{/if}
