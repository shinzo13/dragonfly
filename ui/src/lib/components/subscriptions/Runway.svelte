<script lang="ts">
  import type { Bill, Item } from "#lib/api/types.js";
  import { LINK } from "#lib/components/groups/object-groups.js";
  import { buttonVariants } from "#lib/components/ui/button/button.svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { currentLocale, formatDate } from "#lib/format.js";
  import {
    type Card,
    type Due,
    HORIZONS,
    type Horizon,
    type Need,
    RENEWAL_DAYS,
    sum,
    UNKNOWN,
  } from "#lib/subscriptions/runway.js";
  import { goto } from "$app/navigation";
  import Calendar from "./Calendar.svelte";
  import CardMenu from "./CardMenu.svelte";
  import Money from "./Money.svelte";
  import Sums from "./Sums.svelte";

  let {
    needs,
    strip,
    renewals,
    cards,
    day,
    end,
    horizon,
    byCurrency,
    status,
    onhorizon,
    onmode,
  }: {
    needs: Need[];
    strip: Need[];
    renewals: Due[];
    cards: Card[];
    day: string;
    end: string;
    horizon: Horizon;
    byCurrency: boolean;
    status: string;
    onhorizon: (horizon: Horizon) => void;
    onmode: () => void;
  } = $props();

  let menuFor = $state<Item<Bill> | null>(null);

  const monthName = $derived(
    new Intl.DateTimeFormat(currentLocale(), { month: "long" }).format(
      new Date(`${day}T12:00:00`)
    )
  );
  const label = (id: Horizon, text: string) =>
    id === "month" ? `Rest of ${monthName}` : text;
  const renewalTotals = $derived(sum(renewals.map((d) => d.native)));
  function oncontextmenu(event: MouseEvent) {
    const id = (event.target as Element)
      .closest("[data-bill]")
      ?.getAttribute("data-bill");
    menuFor =
      needs.flatMap((n) => n.dues).find((d) => d.bill.id === id)?.bill ?? null;
  }

  function chosen(due: Due): string {
    const card = byCurrency && due.card ? `${due.card.name}: ` : "";
    if (due.manual) {
      return `${card}set by you`;
    }
    if (!due.lastPaid) {
      return "never paid";
    }
    const where = byCurrency ? "" : " here";
    return `${card}last paid${where} ${formatDate(due.lastPaid, "short")}`;
  }

  const segment = (on: boolean) =>
    buttonVariants({ size: "sm", variant: on ? "default" : "outline" });
</script>

<section class="cladd-surface cladd-outline mb-3 rounded-cladd-lg">
  <header
    class="flex flex-wrap items-center gap-x-4 gap-y-2 border-cladd-outline border-b px-3 py-2"
  >
    <h2 class="me-auto font-semibold text-[15px] text-cladd-fg">
      Needed by {formatDate(end, "day")}
    </h2>
    <fieldset class="flex flex-wrap gap-1">
      <legend class="sr-only">Horizon</legend>
      {#each HORIZONS as h (h.id)}
        <button
          aria-pressed={horizon === h.id}
          class={segment(horizon === h.id)}
          onclick={() => onhorizon(h.id)}
          type="button"
        >
          {label(h.id, h.label)}<span class="kbd max-sm:hidden">{h.key}</span>
        </button>
      {/each}
    </fieldset>
    <fieldset class="flex gap-1">
      <legend class="sr-only">Group by</legend>
      <button
        aria-pressed={!byCurrency}
        class={segment(!byCurrency)}
        onclick={() => byCurrency && onmode()}
        type="button"
      >
        By card
      </button>
      <button
        aria-pressed={byCurrency}
        class={segment(byCurrency)}
        onclick={() => byCurrency || onmode()}
        type="button"
      >
        By currency<span class="kbd max-sm:hidden">v</span>
      </button>
    </fieldset>
  </header>

  {#if status}
    <p class="px-3 py-6 text-cladd-fg-soft">{status}</p>
  {:else if needs.length === 0}
    <p class="px-3 py-4 text-cladd-fg-soft">
      No subscription is due by {formatDate(end, "day")}.
    </p>
  {:else}
    <ContextMenu>
      <ContextMenuTrigger class="outline-none" {oncontextmenu}>
        <div
          class="grid gap-3 p-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]"
        >
          {#each needs as need (need.id)}
            <article
              class="flex flex-col rounded-cladd-md border px-3 py-2.5 {need.short
                ? "border-expense"
                : "border-cladd-outline"}"
            >
              <h3
                class="truncate font-semibold text-[13px] {need.id === UNKNOWN
                  ? "text-warn"
                  : "text-cladd-fg"}"
              >
                {need.name}
              </h3>
              {#each need.totals as total (total.code)}
                <div
                  class="font-semibold text-[26px] text-cladd-fg leading-tight"
                >
                  <Money {...total} exact />
                </div>
              {/each}
              {#if need.short && need.currency}
                <div class="font-semibold text-[14px] text-expense">
                  Short
                  <Money
                    amount={need.short.amount}
                    decimals={need.currency.decimals}
                    symbol={need.currency.symbol}
                  />
                  on {formatDate(need.short.date, "short")}
                </div>
              {/if}
              {#if need.balance !== null && need.currency}
                <div class="text-cladd-fg-soft">
                  {byCurrency ? "On paying cards" : "Balance"}
                  <Money
                    amount={need.balance}
                    class="text-cladd-fg"
                    decimals={need.currency.decimals}
                    symbol={need.currency.symbol}
                  />
                </div>
              {/if}
              <ul class="mt-2 border-cladd-outline border-t pt-1 text-[12px]">
                {#each need.dues as due, i (`${due.bill.id}:${due.date}:${i}`)}
                  <li class="py-0.5" data-bill={due.bill.id}>
                    <div class="flex h-5 items-center gap-2">
                      <span
                        class="num w-12 shrink-0 {due.overdue
                          ? "text-expense"
                          : "text-cladd-fg-soft"}"
                        >{due.overdue
                          ? "overdue"
                          : formatDate(due.date, "short")}</span
                      >
                      <a
                        class="min-w-0 flex-1 truncate text-cladd-fg hover:underline"
                        href="/subscriptions/show/{due.bill.id}"
                        >{due.bill.attributes.name}</a
                      >
                      <Money
                        {...due.pay}
                        approx={due.approx}
                        class="font-medium text-cladd-fg"
                        exact
                      />
                    </div>
                    <div
                      class="truncate ps-14 text-[11px] text-cladd-fg-softer leading-4"
                    >
                      {chosen(due)}
                    </div>
                  </li>
                {/each}
              </ul>
            </article>
          {/each}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-56">
        {#if menuFor}
          {@const target = menuFor}
          <ContextMenuItem
            onSelect={() => goto(`/subscriptions/show/${target.id}`)}
            >Show</ContextMenuItem
          >
          <ContextMenuItem
            onSelect={() => goto(`/subscriptions/edit/${target.id}`)}
            >Edit</ContextMenuItem
          >
          <ContextMenuSeparator />
          <CardMenu billIds={[target.id]} {cards} />
        {/if}
      </ContextMenuContent>
    </ContextMenu>
  {/if}

  {#if !status && renewals.length > 0}
    <p
      class="flex flex-wrap items-baseline gap-x-2 border-cladd-outline border-t px-3 py-2"
    >
      <span class="font-semibold text-cladd-fg"
        >Annual renewals in {RENEWAL_DAYS} days:</span
      >
      <span class="font-semibold text-cladd-fg"
        >{renewals.length}, <Sums inline parts={renewalTotals} /></span
      >
      {#each renewals as due (due.bill.id)}
        <span class="text-cladd-fg-soft"
          ><a class={LINK} href="/subscriptions/show/{due.bill.id}"
            >{due.bill.attributes.name}</a
          >
          {formatDate(due.date, "short")}</span
        >
      {/each}
    </p>
  {/if}

  {#if !status && strip.length > 0}
    <div class="border-cladd-outline border-t">
      <Calendar {day} {end} needs={strip} />
    </div>
  {/if}
</section>
