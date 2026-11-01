<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import { api } from "#lib/api/client.js";
  import { all, invalidate, lists } from "#lib/api/lists.js";
  import type { Bill, Item } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import {
    byObjectGroup,
    LINK,
    sumByCurrency,
    swapOrder,
  } from "#lib/components/groups/object-groups.js";
  import { Arm, errorText } from "#lib/components/misc/action.svelte.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import {
    billKey,
    lastMonths,
    monthly,
    nextExpected,
    repeats,
    status,
    strip,
    yearly,
  } from "#lib/components/subscriptions/bills.js";
  import CardMenu from "#lib/components/subscriptions/CardMenu.svelte";
  import CardPicker from "#lib/components/subscriptions/CardPicker.svelte";
  import Money from "#lib/components/subscriptions/Money.svelte";
  import PaidStatus from "#lib/components/subscriptions/PaidStatus.svelte";
  import Runway from "#lib/components/subscriptions/Runway.svelte";
  import Strip from "#lib/components/subscriptions/Strip.svelte";
  import Sums from "#lib/components/subscriptions/Sums.svelte";
  import { buttonVariants } from "#lib/components/ui/button/button.svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { addDays, today } from "#lib/dates.js";
  import { formatDate, toNumber } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { manualCards } from "#lib/subscriptions/manual.svelte.js";
  import { runwayQueries } from "#lib/subscriptions/queries.js";
  import {
    byBill,
    byCard,
    byCurrency,
    dues,
    HORIZONS,
    type Horizon,
    horizonEnd,
    isYearly,
    matches,
    ownRates,
    type Payment,
    payerOf,
    RENEWAL_DAYS,
    STRIP_DAYS,
    staleSince,
    toCards,
  } from "#lib/subscriptions/runway.js";
  import { type Targets, updateGroups } from "#lib/transactions/mass.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  const day = today();
  const fetchStart = `${day.slice(0, 7)}-01`;
  const fetchEnd = addDays(day, RENEWAL_DAYS);
  const stripEnd = addDays(day, STRIP_DAYS);

  const months = $derived(lastMonths(period.end));
  const billsKey = $derived(["subscriptions", period.start, period.end]);

  const bills = createQuery(() => ({
    enabled: period.ready,
    queryFn: () =>
      all<Bill>("/v1/bills", { end: period.end, start: period.start }),
    queryKey: billsKey,
  }));
  const history = createQuery(() => ({
    enabled: period.ready,
    queryFn: () =>
      all<Bill>("/v1/bills", { end: period.end, start: `${months[0]}-01` }),
    queryKey: ["subscriptions", "history", months[0], period.end],
  }));
  const groups = createQuery(() => lists.objectGroups());
  const upcoming = createQuery(() => runwayQueries.bills(fetchStart, fetchEnd));
  const paid = createQuery(() => runwayQueries.paid());
  const unlinked = createQuery(() => runwayQueries.unlinked(day));
  const assets = createQuery(() => lists.accounts("asset"));

  const params = $derived(page.url.searchParams);
  const hideInactive = $derived(params.get("inactive") === "hide");
  const horizon = $derived<Horizon>(
    HORIZONS.find((h) => h.id === params.get("horizon"))?.id ?? "7"
  );
  const perCurrency = $derived(params.get("by") === "currency");

  const cards = $derived(
    toCards((assets.data ?? []).filter((a) => a.attributes.active !== false))
  );
  const cardList = $derived(
    [...cards.values()].sort((a, b) => a.name.localeCompare(b.name))
  );
  const payments = $derived(byBill(paid.data ?? []));
  const rates = $derived(ownRates(paid.data ?? []));
  const lastOf = (bill: Item<Bill>): Payment | undefined =>
    payments.get(bill.id)?.[0];
  const payer = (bill: Item<Bill>) =>
    payerOf(lastOf(bill), cards, manualCards.get(bill.id));

  const allDues = $derived(dues(upcoming.data ?? [], day, payer, rates));
  const within = (to: string) => allDues.filter((d) => d.date <= to);
  const grouped = (to: string) =>
    perCurrency ? byCurrency(within(to)) : byCard(within(to));
  const end = $derived(horizonEnd(horizon, day));
  const needs = $derived(grouped(end));
  const stripNeeds = $derived(grouped(stripEnd));
  const renewals = $derived(
    within(fetchEnd).filter((d) => isYearly(d.bill.attributes))
  );
  const runwayStatus = $derived.by(() => {
    const failed = [upcoming, paid].find((q) => q.error);
    if (failed?.error) {
      return failed.error.message;
    }
    return upcoming.isPending || paid.isPending ? "Loading" : "";
  });

  const visible = $derived(
    (bills.data ?? []).filter((b) => !hideInactive || b.attributes.active)
  );
  const sections = $derived(byObjectGroup(visible));
  const rows = $derived(sections.flatMap((s) => s.items));
  const offsets = $derived(
    sections.map((_, i) =>
      sections.slice(0, i).reduce((n, s) => n + s.items.length, 0)
    )
  );
  const pastCells = $derived(
    new Map((history.data ?? []).map((b) => [b.id, b.attributes]))
  );
  const found = $derived(
    matches(bills.data ?? [], unlinked.data ?? [], lastOf, day)
  );
  const inactiveGroup = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const { attributes: b } of bills.data ?? []) {
      const title = b.object_group_title;
      if (title) {
        counts.set(title, (counts.get(title) ?? 0) + (b.active ? -1 : 1));
      }
    }
    const [best] = [...counts].sort((a, b) => b[1] - a[1]);
    return best && best[1] > 0 ? best[0] : null;
  });

  const activeOnly = (items: Item<Bill>[]) =>
    items.filter((b) => b.attributes.active).map((b) => b.attributes);
  const perMonth = (items: Item<Bill>[]) =>
    sumByCurrency(activeOnly(items).map(monthly));
  const perYear = (items: Item<Bill>[]) =>
    sumByCurrency(activeOnly(items).map(yearly));

  let menuFor = $state<Item<Bill> | null>(null);
  let armed = $state(false);
  let failure = $state("");
  let linking = $state<Record<string, string>>({});
  const arm = new Arm();

  const show = (b: Item<Bill>) => goto(`/subscriptions/show/${b.id}`);
  const edit = (b: Item<Bill>) => goto(`/subscriptions/edit/${b.id}`);

  function setParam(name: string, value: string | null) {
    const url = new URL(page.url.href);
    if (value === null) {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, value);
    }
    goto(url, { replace: true });
  }

  const toggleInactive = () =>
    setParam("inactive", hideInactive ? null : "hide");
  const setHorizon = (id: Horizon) =>
    setParam("horizon", id === "7" ? null : id);
  const toggleMode = () => setParam("by", perCurrency ? null : "currency");

  async function update(b: Item<Bill>, body: Record<string, unknown>) {
    failure = "";
    try {
      await api(`/v1/bills/${b.id}`, { body, method: "PUT" });
    } catch (e) {
      failure = errorText(e);
    }
    await invalidate();
  }

  function move(dir: 1 | -1): void {
    const { current } = nav;
    const section = sections.find((s) => current && s.items.includes(current));
    if (!(current && section)) {
      return;
    }
    const other = section.items[section.items.indexOf(current) + dir];
    if (!other) {
      return;
    }
    const order = swapOrder(billsKey, current, other);
    nav.move(nav.cursor + dir);
    update(current, { order });
  }

  async function remove(b: Item<Bill>) {
    failure = "";
    try {
      await api(`/v1/bills/${b.id}`, { method: "DELETE" });
    } catch (e) {
      failure = errorText(e);
    }
    await invalidate();
  }

  function deactivate(b: Item<Bill> | undefined) {
    if (b?.attributes.active) {
      arm.press(`off:${b.id}`, () => update(b, { active: false }));
    }
  }

  function retire(b: Item<Bill> | undefined) {
    const title = inactiveGroup;
    if (b && title && b.attributes.object_group_title !== title) {
      arm.press(`move:${b.id}`, () =>
        update(b, { active: false, object_group_title: title })
      );
    }
  }

  async function link(b: Item<Bill> | undefined) {
    const list = b ? found.get(b.id) : undefined;
    if (!(b && list?.length) || linking[b.id]) {
      return;
    }
    const targets: Targets = new Map();
    for (const p of list) {
      const set = targets.get(p.groupId) ?? new Set<string>();
      set.add(p.journalId);
      targets.set(p.groupId, set);
    }
    const say = (text: string) => (linking = { ...linking, [b.id]: text });
    const outcome = await updateGroups(
      targets,
      () => ({ bill_id: b.id }),
      (o) => say(`Linking ${o.done} of ${o.total}`)
    );
    await invalidate();
    say(outcome.errors.length ? `Failed: ${outcome.errors.join("; ")}` : "");
  }

  const activeIds = (items: Item<Bill>[]) =>
    items.filter((b) => b.attributes.active).map((b) => b.id);

  function pick(targets: Item<Bill>[]) {
    const ids = activeIds(targets);
    const here = nav.current?.id ?? "";
    const at = ids.includes(here) ? here : ids[0];
    if (at) {
      manualCards.picking = { at, ids };
    }
  }

  onMount(() => {
    manualCards.migrate();
  });

  const nav: ListNav<Item<Bill>> = new ListNav<Item<Bill>>({
    edit,
    extra: () => [
      ...HORIZONS.map((h) => ({
        group: "Runway",
        keys: h.key,
        label:
          h.id === "month" ? "Needed by end of month" : `Needed in ${h.label}`,
        run: () => setHorizon(h.id),
      })),
      {
        group: "Runway",
        keys: "v",
        label: perCurrency ? "Group by card" : "Group by currency",
        run: toggleMode,
      },
      {
        group: "Subscriptions",
        keys: "a",
        label: "Set paying card (row or selection)",
        run: () => pick(nav.targets),
      },
      {
        group: "Subscriptions",
        keys: "y",
        label: "Link payments found for this subscription",
        run: () => link(nav.current),
      },
      {
        group: "Subscriptions",
        keys: "D",
        label: "Deactivate (press twice)",
        run: () => deactivate(nav.current),
      },
      ...(inactiveGroup
        ? [
            {
              group: "Subscriptions",
              keys: "M",
              label: `Move to ${inactiveGroup} (press twice)`,
              run: () => retire(nav.current),
            },
          ]
        : []),
      {
        group: "Subscriptions",
        keys: "J",
        label: "Move down in group",
        run: () => move(1),
      },
      {
        group: "Subscriptions",
        keys: "K",
        label: "Move up in group",
        run: () => move(-1),
      },
      {
        group: "Subscriptions",
        keys: "c",
        label: "New subscription",
        run: () => goto("/subscriptions/create"),
      },
      {
        group: "Subscriptions",
        keys: "i",
        label: hideInactive ? "Show inactive" : "Hide inactive",
        run: toggleInactive,
      },
    ],
    id: "bills",
    items: () => rows,
    key: billKey,
    open: show,
    selectable: true,
  });
  useKeys(() =>
    nav
      .bindings()
      .filter((b) => b.group !== "Selection" || !["J", "K"].includes(b.keys))
  );

  function rowTone(cursor: boolean, selected: boolean, stale: boolean) {
    if (cursor) {
      return "bg-row-cursor";
    }
    if (selected) {
      return "bg-row-selected";
    }
    return stale ? "bg-warn/10 hover:bg-row-hover" : "hover:bg-row-hover";
  }

  const head =
    "whitespace-nowrap px-3 py-1.5 font-semibold text-[12px] text-cladd-fg-soft";
  const cell = "px-3 py-1 align-middle";
  const action =
    "cladd-surface cladd-gradient cladd-outline cladd-hoverable inline-flex h-6 items-center gap-1.5 rounded-cladd-sm px-2 font-semibold text-[12px]";
</script>

<PageHeader crumbs={[{ label: "Subscriptions" }]} title="Subscriptions">
  {#snippet actions()}
    <a class={buttonVariants({ size: "sm" })} href="/subscriptions/create">
      <Plus />Create new subscription<span class="kbd max-sm:hidden">c</span>
    </a>
  {/snippet}
</PageHeader>

<Runway
  byCurrency={perCurrency}
  cards={cardList}
  {day}
  {end}
  {horizon}
  {needs}
  onhorizon={setHorizon}
  onmode={toggleMode}
  {renewals}
  status={runwayStatus}
  strip={stripNeeds}
/>

<Box body="p-0" title="Subscriptions">
  {#snippet tools()}
    {#if failure || manualCards.failure}
      <span class="text-[12px] text-expense"
        >{failure || manualCards.failure}</span
      >
    {/if}
    <span class="text-[12px] text-cladd-fg-soft">{period.label}</span>
    <button
      class={buttonVariants({ size: "sm", variant: "outline" })}
      onclick={toggleInactive}
      type="button"
    >
      {hideInactive ? "Show inactive" : "Hide inactive"}
      <span class="kbd max-sm:hidden">i</span>
    </button>
  {/snippet}
  {#if bills.isPending}
    <p class="px-3 py-6 text-cladd-fg-soft">Loading subscriptions</p>
  {:else if bills.error}
    <p class="px-3 py-6 text-expense">{bills.error.message}</p>
  {:else if rows.length === 0}
    <p class="px-3 py-6 text-cladd-fg-soft">
      No subscriptions yet.
      <a class={LINK} href="/subscriptions/create">Create a subscription</a>
    </p>
  {:else}
    <ContextMenu onOpenChange={(open) => open || (armed = false)}>
      <ContextMenuTrigger class="block outline-none">
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead>
              <tr class="border-cladd-outline border-b text-left">
                <th class={head}>Name</th>
                <th class="{head} text-right">Amount</th>
                <th class={head}>Paid this period</th>
                <th class="{head} hidden md:table-cell">Next expected match</th>
                <th class="{head} hidden md:table-cell">Card</th>
                <th class="{head} hidden 2xl:table-cell">Repeats</th>
                <th class="{head} hidden 2xl:table-cell">
                  <span class="inline-flex gap-[3px]">
                    {#each months as month (month)}
                      <span class="w-2.5 text-center text-[10px]"
                        >{formatDate(`${month}-01`, "month").slice(0, 1)}</span
                      >
                    {/each}
                  </span>
                </th>
                <th class="{head} hidden text-right lg:table-cell">Per year</th>
              </tr>
            </thead>
            {#each sections as section, s (section.id)}
              {@const monthTotals = perMonth(section.items)}
              <tbody>
                <tr
                  class="border-cladd-outline border-t bg-cladd-surface-next/60"
                >
                  <td
                    class="{cell} whitespace-nowrap font-semibold text-cladd-fg"
                  >
                    {section.title}
                    <span class="ms-1 font-normal text-cladd-fg-softer"
                      >{section.items.length}</span
                    >
                  </td>
                  <td class="{cell} text-right font-semibold text-cladd-fg">
                    <Sums parts={monthTotals} />
                  </td>
                  <td class="{cell} text-[12px] text-cladd-fg-soft">
                    {monthTotals.length > 0 ? "a month" : ""}
                  </td>
                  <td class="hidden md:table-cell"></td>
                  <td class="hidden md:table-cell"></td>
                  <td class="hidden 2xl:table-cell"></td>
                  <td class="hidden 2xl:table-cell"></td>
                  <td
                    class="{cell} hidden text-right font-semibold text-cladd-fg-soft lg:table-cell"
                  >
                    <Sums parts={perYear(section.items)} />
                  </td>
                </tr>
                {#each section.items as item, j (item.id)}
                  {@const i = offsets[s] + j}
                  {@const bill = item.attributes}
                  {@const ends = bill.end_date?.slice(0, 10)}
                  {@const last = lastOf(item)}
                  {@const who = payer(item)}
                  {@const stale = paid.isSuccess
                    ? staleSince(bill, last, day)
                    : null}
                  {@const extra = found.get(item.id) ?? []}
                  {@const armedHere = arm.key?.endsWith(`:${item.id}`)}
                  <tr
                    class="h-7 border-cladd-outline/60 border-t {rowTone(
                      nav.cursor === i,
                      nav.isSelected(item),
                      stale !== null
                    )} {bill.active ? "text-cladd-fg" : "text-cladd-fg-softer"}"
                    id={nav.rowId(i)}
                    onclick={(e) => nav.click(i, e)}
                    oncontextmenu={() => {
                      menuFor = item;
                      nav.cursor = i;
                    }}
                  >
                    <td class="{cell} md:whitespace-nowrap">
                      <a
                        class="hover:underline"
                        href="/subscriptions/show/{item.id}"
                      >
                        {#if !bill.active}
                          <Ban
                            aria-label="Inactive"
                            class="me-1 inline size-3.5 align-[-2px]"
                          />
                        {/if}
                        {bill.name}
                      </a>
                    </td>
                    <td class="{cell} whitespace-nowrap text-right font-medium">
                      {#if toNumber(bill.amount_max) !==
                        toNumber(bill.amount_min)}
                        <span
                          class="num me-1.5 font-normal text-[12px] text-cladd-fg-softer max-md:hidden"
                          >{toNumber(bill.amount_min)}–{toNumber(
                            bill.amount_max
                          )}</span
                        >
                      {/if}
                      <Money
                        amount={(toNumber(bill.amount_min) +
                          toNumber(bill.amount_max)) /
                          2}
                        approx={toNumber(bill.amount_max) !==
                          toNumber(bill.amount_min)}
                        code={bill.currency_code}
                        decimals={bill.currency_decimal_places}
                        symbol={bill.currency_symbol ?? ""}
                      />
                    </td>
                    <td class="{cell} md:whitespace-nowrap">
                      {#if stale !== null}
                        <span class="text-warn"
                          >{#if stale}
                            Unpaid since
                            <span class="whitespace-nowrap"
                              >{formatDate(stale, "short")}</span
                            >
                          {:else}
                            Never paid
                          {/if}</span
                        >
                      {:else}
                        <PaidStatus state={status(bill, period.range)} />
                      {/if}
                    </td>
                    <td class="{cell} num hidden md:table-cell">
                      {bill.active ? formatDate(nextExpected(bill)) : ""}
                    </td>
                    <td class="{cell} hidden whitespace-nowrap md:table-cell">
                      {#if manualCards.picking?.at === item.id}
                        <CardPicker
                          billIds={manualCards.picking.ids}
                          cards={cardList}
                        />
                      {:else if bill.active && paid.isSuccess}
                        {#if who.card}
                          <span class="text-cladd-fg-soft"
                            >{who.card.name}</span
                          >
                          {#if who.manual}
                            <span class="ms-1 text-[12px] text-cladd-fg-softer"
                              >set by you</span
                            >
                          {/if}
                        {:else}
                          <span class="text-warn">card unknown</span>
                        {/if}
                      {/if}
                    </td>
                    <td class="{cell} hidden whitespace-nowrap 2xl:table-cell">
                      {repeats(bill)}
                      {#if ends}
                        <span
                          class={ends < day
                            ? "text-expense"
                            : "text-cladd-fg-soft"}
                          >, ends {formatDate(ends)}</span
                        >
                      {/if}
                    </td>
                    <td class="{cell} hidden 2xl:table-cell">
                      <Strip
                        cells={strip(pastCells.get(item.id) ?? bill, months)}
                        {months}
                      />
                    </td>
                    <td
                      class="{cell} hidden text-right text-cladd-fg-soft lg:table-cell"
                    >
                      {#if bill.active}
                        <Money {...yearly(bill)} />
                      {/if}
                    </td>
                  </tr>
                  {#if extra.length > 0 || stale !== null || armedHere}
                    <tr class="border-0">
                      <td class="px-3 pb-1.5 text-[12px]" colspan="8">
                        <div
                          class="flex w-0 min-w-full flex-wrap items-center gap-x-3 gap-y-1 ps-4"
                        >
                          {#if extra.length > 0}
                            <span class="text-warn">Not linked:</span>
                            {#each extra as p (p.journalId)}
                              <a
                                class="text-cladd-fg hover:underline"
                                href="/transactions/show/{p.groupId}"
                                ><span class="num text-cladd-fg-soft"
                                  >{formatDate(p.date, "short")}</span
                                >
                                {p.description}
                                <Money {...p} class="font-medium" /></a
                              >
                            {/each}
                            <button
                              class="{action} text-cladd-fg"
                              disabled={Boolean(linking[item.id])}
                              onclick={() => link(item)}
                              type="button"
                            >
                              Link
                              {extra.length === 1
                                ? "it"
                                : `all ${extra.length}`}<span
                                class="kbd max-sm:hidden"
                                >y</span
                              >
                            </button>
                            {#if linking[item.id]}
                              <span
                                aria-live="polite"
                                class="text-cladd-fg-soft"
                                >{linking[item.id]}</span
                              >
                            {/if}
                          {/if}
                          {#if stale !== null || armedHere}
                            <button
                              class="{action} {arm.key === `off:${item.id}`
                                ? "cladd-color-red text-cladd-primary"
                                : "text-cladd-fg"}"
                              onclick={() => deactivate(item)}
                              type="button"
                            >
                              {arm.key === `off:${item.id}`
                                ? "Press D again to deactivate"
                                : "Deactivate"}<span class="kbd max-sm:hidden"
                                >D</span
                              >
                            </button>
                            {#if inactiveGroup}
                              <button
                                class="{action} {arm.key === `move:${item.id}`
                                  ? "cladd-color-red text-cladd-primary"
                                  : "text-cladd-fg"}"
                                onclick={() => retire(item)}
                                type="button"
                              >
                                {arm.key === `move:${item.id}`
                                  ? `Press M again to move to ${inactiveGroup}`
                                  : `Move to ${inactiveGroup}`}<span
                                  class="kbd max-sm:hidden"
                                  >M</span
                                >
                              </button>
                            {/if}
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            {/each}
            {#if sections.length > 1}
              <tfoot>
                <tr class="border-cladd-outline border-t-2">
                  <td class="{cell} font-semibold text-cladd-fg">
                    Total, active subscriptions
                  </td>
                  <td class="{cell} text-right font-semibold text-cladd-fg">
                    <Sums parts={perMonth(rows)} />
                  </td>
                  <td class="{cell} text-[12px] text-cladd-fg-soft">a month</td>
                  <td class="hidden md:table-cell"></td>
                  <td class="hidden md:table-cell"></td>
                  <td class="hidden 2xl:table-cell"></td>
                  <td class="hidden 2xl:table-cell"></td>
                  <td
                    class="{cell} hidden text-right font-semibold text-cladd-fg-soft lg:table-cell"
                  >
                    <Sums parts={perYear(rows)} />
                  </td>
                </tr>
              </tfoot>
            {/if}
          </table>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-56">
        {#if menuFor}
          {@const target = menuFor}
          <ContextMenuItem onSelect={() => show(target)}>Show</ContextMenuItem>
          <ContextMenuItem onSelect={() => edit(target)}>Edit</ContextMenuItem>
          {#if target.attributes.active}
            <CardMenu
              billIds={nav.isSelected(target)
                ? activeIds(nav.selection)
                : [target.id]}
              cards={cardList}
            />
          {/if}
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to group</ContextMenuSubTrigger>
            <ContextMenuSubContent class="max-h-80 w-52">
              {#each groups.data ?? [] as group (group.id)}
                <ContextMenuItem
                  disabled={group.id === target.attributes.object_group_id}
                  onSelect={() =>
                    update(target, {
                      object_group_title: group.attributes.title,
                    })}
                  >{group.attributes.title}</ContextMenuItem
                >
              {/each}
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={!target.attributes.object_group_id}
                onSelect={() => update(target, { object_group_title: "" })}
                >No group</ContextMenuItem
              >
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem
            onSelect={() =>
              update(target, { active: !target.attributes.active })}
            >{target.attributes.active
              ? "Deactivate"
              : "Activate"}</ContextMenuItem
          >
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() =>
              location.assign(`/rules/create-from-bill/${target.id}`)}
            >Create rule from subscription</ContextMenuItem
          >
          <ContextMenuItem
            onSelect={() =>
              location.assign(
                oldUiUrl(`${location.origin}/subscriptions/show/${target.id}`)
              )}
            >Open in old UI</ContextMenuItem
          >
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={(e) => {
              if (!armed) {
                e.preventDefault();
                armed = true;
                return;
              }
              remove(target);
            }}
            variant="destructive"
            >{armed ? "Press again to delete" : "Delete"}</ContextMenuItem
          >
        {/if}
      </ContextMenuContent>
    </ContextMenu>
  {/if}
  {#snippet footer()}
    <a
      class={buttonVariants({ size: "sm", variant: "outline" })}
      href="/subscriptions/create"
      ><Plus />Create new subscription</a
    >
  {/snippet}
</Box>
