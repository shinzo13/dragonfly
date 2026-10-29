<script lang="ts">
  import {
    type Action,
    type Actions,
    averageDays,
    type Movement,
    months,
    overpaid,
    owed,
    stance,
  } from "#lib/accounts/ledger.js";
  import type { Account, Item } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import { daysBetween, today } from "#lib/dates.js";
  import { formatDate, formatMoney } from "#lib/format.js";
  import { showUrl as transactionUrl } from "#lib/transactions/split.js";
  import { showUrl } from "./links.js";
  import MonthBars from "./MonthBars.svelte";

  const BUTTON =
    "cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-[12px] text-cladd-fg";
  const PRIMARY = `${BUTTON} cladd-color-green text-cladd-primary`;

  let {
    item,
    list,
    actions,
    keys,
    rows = 5,
    named = true,
    current = false,
    id,
    onfocusin,
  }: {
    item: Item<Account>;
    list: Movement[] | undefined;
    actions: Actions | null;
    keys: Record<keyof Actions, string>;
    rows?: number;
    named?: boolean;
    current?: boolean;
    id?: string;
    onfocusin?: () => void;
  } = $props();

  const a = $derived(item.attributes);
  const credit = $derived(a.liability_direction !== "debit");
  const side = $derived(stance(a));
  const amount = $derived(Math.abs(owed(a)));
  const cur = $derived({
    code: a.currency_code,
    decimals: a.currency_decimal_places,
    symbol: a.currency_symbol,
  });
  const format = (value: number) => formatMoney({ ...cur, amount: value });
  const bars = $derived(list ? months(list) : []);
  const sent = $derived(bars.reduce((s, m) => s + m.sent, 0));
  const received = $derived(bars.reduce((s, m) => s + m.received, 0));
  const average = $derived(list ? averageDays(list, credit) : null);
  const last = $derived(list?.[0]);
  const shown = $derived(list?.slice(0, rows) ?? []);

  function ago(date: string) {
    const days = daysBetween(date, today());
    if (days === 0) {
      return "today";
    }
    return days === 1 ? "yesterday" : `${days} days ago`;
  }
</script>

{#snippet button(
  action: Action,
  key: string,
  primary = false
)}
  <a
    aria-label={action.hint}
    class={primary ? PRIMARY : BUTTON}
    href={action.href}
    >{action.label} <span class="kbd">{key}</span></a
  >
{/snippet}

<article
  class="cladd-surface cladd-outline flex min-w-0 flex-col rounded-cladd-lg {current
    ? "outline-2 outline-(--ff-brand)"
    : ""}"
  {id}
  {onfocusin}
>
  <div class="flex flex-1 flex-col gap-3 p-3">
    <div>
      {#if named}
        <h3 class="truncate font-semibold text-[15px] leading-snug">
          <a class="hover:underline" href={showUrl(item.id)} title={a.name}
            >{a.name}</a
          >
        </h3>
      {/if}
      {#if side === "settled"}
        <p class="font-semibold text-[28px] text-cladd-fg-soft leading-tight">
          Settled
        </p>
      {:else}
        <p class="flex flex-wrap items-baseline gap-x-2">
          <span class="text-[15px] text-cladd-fg-soft"
            >{side === "owed" ? "Owes you" : "You owe"}</span
          >
          <span
            class="num font-semibold text-[28px] leading-tight {side === "owed"
              ? "text-income"
              : "text-expense"}"
            >{format(amount)}</span
          >
        </p>
      {/if}
      {#if overpaid(a)}
        <p class="text-[13px] text-cladd-fg-soft">
          {credit ? "Paid you back" : "You paid back"}
          <span class="num">{format(amount)}</span>
          more than borrowed
        </p>
      {/if}
    </div>

    {#if last}
      <dl
        class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[13px]"
      >
        <dt class="text-cladd-fg-soft">Last movement</dt>
        <dd class="text-right">{formatDate(last.date)}, {ago(last.date)}</dd>
        {#if average === null}
          <dt class="col-span-2 text-cladd-fg-soft">No repayments yet</dt>
        {:else}
          <dt class="text-cladd-fg-soft">
            {credit ? "Usually pays back in" : "You usually pay back in"}
          </dt>
          <dd class="text-right">
            {average}
            {average === 1 ? "day" : "days"}
          </dd>
        {/if}
        {#if received > 0}
          <dt class="text-cladd-fg-soft">Received in 12 months</dt>
          <dd class="num text-right text-income">{format(received)}</dd>
        {/if}
        {#if sent > 0}
          <dt class="text-cladd-fg-soft">Sent in 12 months</dt>
          <dd class="num text-right text-expense">{format(sent)}</dd>
        {/if}
      </dl>
    {/if}

    {#if received + sent > 0}
      <MonthBars {format} months={bars} />
    {/if}

    {#if rows > 0}
      <table class="w-full table-fixed border-collapse text-[13px]">
        <tbody>
          {#each shown as m, i (`${m.group}-${i}`)}
            <tr class="h-7 border-cladd-outline/60 border-t">
              <td class="w-16 whitespace-nowrap text-cladd-fg-soft">
                {formatDate(m.date, "short")}
              </td>
              <td class="truncate">
                <a
                  class="hover:underline"
                  href={transactionUrl(m.group)}
                  title={m.description}
                  >{m.opening ? "Opening balance" : m.description}</a
                >
              </td>
              <td class="w-28 whitespace-nowrap text-right">
                <Amount
                  {...cur}
                  amount={m.into ? -m.amount : m.amount}
                  exact
                  signed
                />
              </td>
            </tr>
          {:else}
            <tr class="h-7 border-cladd-outline/60 border-t">
              <td class="text-cladd-fg-soft" colspan="3">
                {list ? "No movements yet" : ""}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if actions}
    <footer
      class="flex flex-col gap-1.5 border-cladd-outline border-t px-3 py-2"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        {#if actions.repay}
          {@render button(actions.repay, keys.repay, true)}
        {/if}
        {@render button(actions.more, keys.more)}
        {#if actions.offset}
          {@render button(actions.offset, keys.offset)}
        {/if}
      </div>
      {#if actions.offset?.line}
        <p class="text-[12px] text-cladd-fg-soft">{actions.offset.line}</p>
      {/if}
    </footer>
  {/if}
</article>
