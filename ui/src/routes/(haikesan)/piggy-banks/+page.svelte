<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import { invalidate, lists } from "#lib/api/lists.js";
  import type { Item, PiggyBank } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import { tones } from "#lib/components/charts/chart.js";
  import Meter from "#lib/components/charts/Meter.svelte";
  import {
    byObjectGroup,
    LINK,
    sumByCurrency,
    swapOrder,
  } from "#lib/components/groups/object-groups.js";
  import Totals from "#lib/components/groups/Totals.svelte";
  import { errorText } from "#lib/components/misc/action.svelte.js";
  import MoneyEditor from "#lib/components/piggy-banks/MoneyEditor.svelte";
  import {
    type Mode,
    piggyMoney,
    rooms,
  } from "#lib/components/piggy-banks/piggy.js";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { buttonVariants } from "#lib/components/ui/button/button.svelte";
  import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
  } from "#lib/components/ui/context-menu/index.js";
  import { formatDate, percent, toNumber } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { oldUiUrl } from "#lib/spa-paths.js";
  import { goto } from "$app/navigation";

  const piggyQuery = lists.piggyBanks();
  const piggies = createQuery(() => piggyQuery);
  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));

  const all = $derived(piggies.data ?? []);
  const sections = $derived(byObjectGroup(all));
  const rows = $derived(sections.flatMap((s) => s.items));
  const offsets = $derived(
    sections.map((_, i) =>
      sections.slice(0, i).reduce((n, s) => n + s.items.length, 0)
    )
  );
  const room = $derived(
    rooms(all, [...(assets.data ?? []), ...(liabilities.data ?? [])])
  );

  let editing = $state<{ id: string; mode: Mode } | null>(null);
  let menuFor = $state<Item<PiggyBank> | null>(null);
  let armed = $state(false);
  let failure = $state("");

  const sum = (items: Item<PiggyBank>[], field: keyof PiggyBank) =>
    sumByCurrency(
      items
        .filter((p) => toNumber(p.attributes[field] as string) > 0)
        .map((p) => piggyMoney(p.attributes, p.attributes[field]))
    );

  function startMoney(p: Item<PiggyBank> | undefined, mode: Mode): void {
    if (p) {
      nav.cursor = rows.indexOf(p);
      editing = { id: p.id, mode };
    }
  }

  async function update(p: Item<PiggyBank>, body: Record<string, unknown>) {
    failure = "";
    try {
      await api(`/v1/piggy-banks/${p.id}`, { body, method: "PUT" });
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
    const order = swapOrder(piggyQuery.queryKey, current, other);
    nav.move(nav.cursor + dir);
    update(current, { order });
  }

  async function remove(p: Item<PiggyBank>) {
    failure = "";
    try {
      await api(`/v1/piggy-banks/${p.id}`, { method: "DELETE" });
    } catch (e) {
      failure = errorText(e);
    }
    await invalidate();
  }

  const nav: ListNav<Item<PiggyBank>> = new ListNav<Item<PiggyBank>>({
    edit: (p) => goto(`/piggy-banks/edit/${p.id}`),
    extra: () => [
      {
        group: "Piggy banks",
        keys: "+",
        label: "Add money",
        run: () => startMoney(nav.current, "add"),
      },
      {
        group: "Piggy banks",
        hidden: true,
        keys: "=",
        label: "Add money",
        run: () => startMoney(nav.current, "add"),
      },
      {
        group: "Piggy banks",
        keys: "-",
        label: "Remove money",
        run: () => startMoney(nav.current, "remove"),
      },
      {
        group: "Piggy banks",
        keys: "J",
        label: "Move down in group",
        run: () => move(1),
      },
      {
        group: "Piggy banks",
        keys: "K",
        label: "Move up in group",
        run: () => move(-1),
      },
      {
        group: "Piggy banks",
        keys: "c",
        label: "New piggy bank",
        run: () => goto("/piggy-banks/create"),
      },
    ],
    id: "piggies",
    items: () => rows,
    key: (p) => p.id,
    open: (p) => goto(`/piggy-banks/show/${p.id}`),
  });
  nav.use();

  const head = "px-3 py-1.5 font-semibold text-[12px] text-cladd-fg-soft";
  const cell = "px-3 py-1 align-middle";
  const wide = "hidden md:table-cell";
  const COLUMNS = 9;
</script>

<PageHeader crumbs={[{ label: "Piggy banks" }]} title="Piggy banks">
  {#snippet actions()}
    <a class={buttonVariants({ size: "sm" })} href="/piggy-banks/create">
      <Plus />Create new piggy bank<span class="kbd">c</span>
    </a>
  {/snippet}
</PageHeader>

<Box body="p-0" title="Piggy banks">
  {#snippet tools()}
    {#if failure}
      <span class="text-[12px] text-expense">{failure}</span>
    {/if}
  {/snippet}
  {#if piggies.isPending}
    <p class="px-3 py-6 text-cladd-fg-soft">Loading piggy banks</p>
  {:else if piggies.error}
    <p class="px-3 py-6 text-expense">{piggies.error.message}</p>
  {:else if rows.length === 0}
    <p class="px-3 py-6 text-cladd-fg-soft">
      No piggy banks yet.
      <a class={LINK} href="/piggy-banks/create">Create a piggy bank</a>
    </p>
  {:else}
    <ContextMenu onOpenChange={(open) => open || (armed = false)}>
      <ContextMenuTrigger>
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead>
              <tr class="border-cladd-outline border-b text-left">
                <th class={head}>Piggy bank</th>
                <th class="{head} text-right">Saved so far</th>
                <th class={head} colspan="3"></th>
                <th class="{head} {wide} text-right">Target amount</th>
                <th class="{head} {wide} text-right">Left to save</th>
                <th class="{head} hidden text-right lg:table-cell">
                  Suggested per month
                </th>
                <th class="{head} hidden lg:table-cell">Target date</th>
              </tr>
            </thead>
            {#each sections as section, s (section.id)}
              <tbody>
                <tr
                  class="border-cladd-outline border-t bg-cladd-surface-next/60 font-semibold"
                >
                  <td class={cell}>
                    {section.title}
                    <span class="ms-1 font-normal text-cladd-fg-softer"
                      >{section.items.length}</span
                    >
                  </td>
                  <td class="{cell} text-right">
                    <Totals
                      tone="income"
                      totals={sum(section.items, "current_amount")}
                    />
                  </td>
                  <td colspan="3"></td>
                  <td class="{cell} {wide} text-right">
                    <Totals totals={sum(section.items, "target_amount")} />
                  </td>
                  <td class="{cell} {wide} text-right">
                    <Totals totals={sum(section.items, "left_to_save")} />
                  </td>
                  <td class="{cell} hidden text-right lg:table-cell">
                    <Totals totals={sum(section.items, "save_per_month")} />
                  </td>
                  <td class="hidden lg:table-cell"></td>
                </tr>
                {#each section.items as item, j (item.id)}
                  {@const i = offsets[s] + j}
                  {@const p = item.attributes}
                  {@const pct = p.percentage}
                  <tr
                    class="h-7 border-cladd-outline/60 border-t {nav.cursor ===
                    i
                      ? "bg-row-cursor"
                      : "hover:bg-row-hover"}"
                    id={nav.rowId(i)}
                    onclick={(e) => nav.click(i, e)}
                    oncontextmenu={() => {
                      menuFor = item;
                      nav.cursor = i;
                    }}
                  >
                    <td class={cell}>
                      <a class={LINK} href="/piggy-banks/show/{item.id}"
                        >{p.name}</a
                      >
                    </td>
                    <td class="{cell} text-right">
                      <Amount
                        {...piggyMoney(p, p.current_amount)}
                        tone="income"
                      />
                    </td>
                    <td class="w-8 py-1 ps-2 text-right">
                      <button
                        aria-label="Remove money from {p.name}"
                        class={buttonVariants({
                          size: "icon-xs",
                          variant: "ghost",
                        })}
                        onclick={() => startMoney(item, "remove")}
                        title="Remove money (-)"
                        type="button"
                      >
                        <Minus />
                      </button>
                    </td>
                    <td class="w-24 py-1 sm:w-40">
                      {#if pct !== null && pct !== undefined}
                        <div class="flex items-center gap-2">
                          <Meter
                            label={percent(pct / 100)}
                            max={toNumber(p.target_amount)}
                            segments={[
                              {
                                color: pct >= 100 ? tones.income : undefined,
                                value: toNumber(p.current_amount),
                              },
                            ]}
                          />
                          <span
                            class="num w-9 text-right text-[12px] text-cladd-fg-soft"
                            >{percent(pct / 100)}</span
                          >
                        </div>
                      {/if}
                    </td>
                    <td class="w-8 py-1 pe-2">
                      <button
                        aria-label="Add money to {p.name}"
                        class={buttonVariants({
                          size: "icon-xs",
                          variant: "ghost",
                        })}
                        onclick={() => startMoney(item, "add")}
                        title="Add money (+)"
                        type="button"
                      >
                        <Plus />
                      </button>
                    </td>
                    <td class="{cell} {wide} text-right">
                      {#if toNumber(p.target_amount) > 0}
                        <span class="num"
                          >{display.text([
                            piggyMoney(p, p.target_amount),
                          ])}</span
                        >
                      {/if}
                    </td>
                    <td class="{cell} {wide} text-right">
                      {#if toNumber(p.left_to_save) > 0}
                        <span class="num"
                          >{display.text([piggyMoney(p, p.left_to_save)])}</span
                        >
                      {/if}
                    </td>
                    <td class="{cell} hidden text-right lg:table-cell">
                      {#if p.target_date && toNumber(p.save_per_month) > 0}
                        <span class="num"
                          >{display.text([
                            piggyMoney(p, p.save_per_month),
                          ])}</span
                        >
                      {/if}
                    </td>
                    <td class="{cell} num hidden lg:table-cell">
                      {formatDate(p.target_date)}
                    </td>
                  </tr>
                  {#if editing?.id === item.id}
                    <tr class="border-cladd-outline/60 border-t bg-row-hover">
                      <td class="px-3 py-2" colspan={COLUMNS}>
                        <MoneyEditor
                          mode={editing.mode}
                          onclose={() => (editing = null)}
                          piggy={item}
                          rooms={room}
                        />
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            {/each}
          </table>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-52">
        {#if menuFor}
          {@const target = menuFor}
          <ContextMenuItem
            onSelect={() => goto(`/piggy-banks/show/${target.id}`)}
            >Show</ContextMenuItem
          >
          <ContextMenuItem
            onSelect={() => goto(`/piggy-banks/edit/${target.id}`)}
            >Edit</ContextMenuItem
          >
          <ContextMenuItem onSelect={() => startMoney(target, "add")}
            >Add money</ContextMenuItem
          >
          <ContextMenuItem onSelect={() => startMoney(target, "remove")}
            >Remove money</ContextMenuItem
          >
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() =>
              location.assign(
                oldUiUrl(`${location.origin}/piggy-banks/show/${target.id}`)
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
      href="/piggy-banks/create"
      ><Plus />Create new piggy bank</a
    >
  {/snippet}
</Box>

{#if room.size > 0}
  <Box body="p-0" class="mt-3" title="Account status">
    <div class="overflow-x-auto">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="border-cladd-outline border-b text-left">
            <th class={head}>Account</th>
            <th class="{head} {wide} text-right">Balance</th>
            <th class="{head} text-right">Left for piggy banks</th>
            <th class="{head} {wide} text-right">Sum of piggy banks</th>
            <th class="{head} {wide} text-right">Saved so far</th>
            <th class="{head} {wide} text-right">Left to save</th>
          </tr>
        </thead>
        <tbody>
          {#each [...room] as [id, r] (id)}
            {@const linked = all.filter((p) =>
              p.attributes.accounts?.some((a) => a.account_id === id)
            )}
            {@const a = r.account?.attributes}
            {@const money = {
              code: a?.currency_code,
              decimals: a?.currency_decimal_places,
              symbol: a?.currency_symbol,
            }}
            {@const targets = linked.reduce(
              (t, p) => t + toNumber(p.attributes.target_amount),
              0
            )}
            <tr class="h-7 border-cladd-outline/60 border-t hover:bg-row-hover">
              <td class={cell}>
                <a class={LINK} href="/accounts/show/{id}">{a?.name ?? id}</a>
              </td>
              <td class="{cell} {wide} text-right">
                <Amount {...money} amount={r.balance} tone="auto" />
              </td>
              <td class="{cell} text-right">
                <Amount {...money} amount={r.free} tone="auto" />
              </td>
              <td class="{cell} {wide} text-right">
                <span class="num"
                  >{display.text([{ ...money, amount: targets }])}</span
                >
              </td>
              <td class="{cell} {wide} text-right">
                <Amount {...money} amount={r.earmarked} tone="income" />
              </td>
              <td class="{cell} {wide} text-right">
                <span class="num"
                  >{display.text([
                    { ...money, amount: Math.max(0, targets - r.earmarked) },
                  ])}</span
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Box>
{/if}
