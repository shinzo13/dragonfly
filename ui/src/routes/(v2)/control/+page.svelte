<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Minus from "@lucide/svelte/icons/minus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import { today } from "#lib/dates.js";
  import { toNumber } from "#lib/format.js";
  import { useKeys } from "#lib/keys.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Chip from "#lib/v2/components/Chip.svelte";
  import BillForm from "#lib/v2/forms/BillForm.svelte";
  import BudgetForm from "#lib/v2/forms/BudgetForm.svelte";
  import PiggyForm from "#lib/v2/forms/PiggyForm.svelte";
  import PiggyMoney from "#lib/v2/forms/PiggyMoney.svelte";
  import { q } from "#lib/v2/data.js";
  import { look } from "#lib/v2/look.svelte.js";
  import { money, primaryCode, view } from "#lib/v2/money.svelte.js";
  import { isBlockade, toRow } from "#lib/v2/tx.js";
  import { daysBetween, daysIn, periodName, shortDate } from "#lib/v2/when.js";

  const TABS = [
    { id: "budgets", label: "Budgets" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "piggy", label: "Piggy banks" },
  ] as const;

  const tab = $derived(TABS.find((t) => t.id === page.url.searchParams.get("tab"))?.id ?? "budgets");

  function open(id: string) {
    const next = new URL(page.url.href);
    next.searchParams.set("tab", id);
    goto(next, { replace: true });
  }

  useKeys(() => TABS.map((t, i) => ({ group: "Page", keys: String(i + 1), label: t.label, run: () => open(t.id) })));

  const budgets = createQuery(() => q.budgets(period.start, period.end));
  const limits = createQuery(() => q.limits(period.start, period.end));
  const txs = createQuery(() => q.transactions(period.start, period.end));
  const bills = createQuery(() => q.bills(period.start, period.end));
  const piggies = createQuery(() => q.piggies());

  const now = today();
  const length = $derived(daysBetween(period.start, period.end) + 1);
  const elapsed = $derived(now < period.start ? 0 : now > period.end ? 1 : (daysBetween(period.start, now) + 1) / length);
  const left = $derived(Math.max(0, daysBetween(now, period.end)));

  const splitValue = (s: { amount: string; currency_code?: string; pc_amount?: string }) =>
    Math.abs(view.conv(s.amount, s.currency_code) ?? view.fromPrimary(s.pc_amount));

  const budgetRows = $derived.by(() => {
    if (!view.ready) {
      return [];
    }
    const outs = (txs.data ?? []).map(toRow).filter((r) => r.kind === "out" && !isBlockade(r));
    const ids = new Set((budgets.data ?? []).map((b) => b.id));
    const groups = new Map<string, Map<string, { id: string | null; name: string; value: number }>>();
    let outside = 0;
    const outsideCats = new Map<string, { id: string | null; name: string; value: number }>();
    for (const row of outs) {
      for (const s of row.splits) {
        const key = s.budget_id && ids.has(s.budget_id) ? s.budget_id : null;
        const value = splitValue(s);
        const cats = key ? (groups.get(key) ?? new Map()) : outsideCats;
        const catKey = s.category_id ?? "none";
        const slot = cats.get(catKey) ?? { id: s.category_id ?? null, name: s.category_name ?? "No category", value: 0 };
        slot.value += value;
        cats.set(catKey, slot);
        if (key) {
          groups.set(key, cats);
        } else {
          outside += value;
        }
      }
    }
    const list = (budgets.data ?? [])
      .filter((b) => b.attributes.active)
      .map((b) => {
        const own = (limits.data ?? []).filter((l) => l.attributes.budget_id === b.id);
        const limit = own.reduce((s, l) => s + (view.conv(l.attributes.amount, l.attributes.currency_code) ?? 0), 0);
        const cats = [...(groups.get(b.id)?.values() ?? [])].sort((x, y) => y.value - x.value);
        const spent = cats.reduce((s, c) => s + c.value, 0);
        return { cats, id: b.id, limit, name: b.attributes.name, spent };
      });
    return { list, outside, outsideCats: [...outsideCats.values()].sort((x, y) => y.value - x.value) };
  });

  const billRows = $derived.by(() => {
    if (!view.ready) {
      return [];
    }
    return (bills.data ?? [])
      .filter((b) => b.attributes.active)
      .map((b) => {
        const a = b.attributes;
        const paid = (a.paid_dates ?? []).filter((p) => p.date).map((p) => ({ date: (p.date ?? "").slice(0, 10), group: p.transaction_group_id }));
        const due = (a.pay_dates ?? []).map((d) => d.slice(0, 10)).filter((d) => !paid.some((p) => p.date === d));
        const next = due[0] ?? a.next_expected_match?.slice(0, 10) ?? null;
        return {
          amount: view.conv(a.amount_min, a.currency_code) ?? view.fromPrimary(a.pc_amount_min),
          code: a.currency_code ?? "",
          due,
          id: b.id,
          name: a.name,
          next,
          orig: toNumber(a.amount_min),
          overdue: due.some((d) => d < now),
          paid,
          repeat: a.repeat_freq ?? "",
        };
      })
      .sort((x, y) => (x.next ?? "9").localeCompare(y.next ?? "9"));
  });

  const calendar = $derived.by(() => {
    const days = daysIn(period.start, period.end);
    if (days.length > 62) {
      return null;
    }
    const lead = (new Date(`${period.start}T00:00`).getDay() + 6) % 7;
    const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...days];
    while (cells.length % 7) {
      cells.push(null);
    }
    return cells;
  });

  const billsOn = (date: string) =>
    billRows.flatMap((b) => [
      ...b.paid.filter((p) => p.date === date).map(() => ({ bill: b, state: "paid" as const })),
      ...b.due.filter((d) => d === date).map(() => ({ bill: b, state: date < now ? ("late" as const) : ("due" as const) })),
    ]);

  const later = $derived(billRows.filter((b) => b.due.some((d) => d > period.end)));

  const piggyRows = $derived(
    (piggies.data ?? []).map((p) => {
      const a = p.attributes as typeof p.attributes & { start_date?: string | null };
      const current = toNumber(a.current_amount);
      const target = toNumber(a.target_amount);
      const end = a.target_date?.slice(0, 10) ?? null;
      const months = end && end > now ? Math.max(1, Math.ceil(daysBetween(now, end) / 30.4)) : null;
      return {
        account: a.accounts?.[0],
        code: a.currency_code ?? primaryCode(),
        current,
        end,
        id: p.id,
        monthly: months && target > current ? (target - current) / months : null,
        name: a.name,
        target,
      };
    })
  );

  let budgetOpen = $state(false);
  let billOpen = $state(false);
  let piggyOpen = $state(false);
  let moneyOpen = $state(false);
  let moneyMode = $state("add");
  let editId = $state<string | null>(null);

  function edit(kind: "budget" | "bill" | "piggy", id: string | null = null) {
    editId = id;
    if (kind === "budget") {
      budgetOpen = true;
    } else if (kind === "bill") {
      billOpen = true;
    } else {
      piggyOpen = true;
    }
  }

  function moneyFor(id: string, mode: string) {
    editId = id;
    moneyMode = mode;
    moneyOpen = true;
  }

  const editBudget = $derived(budgets.data?.find((b) => b.id === editId));
  const editLimit = $derived(limits.data?.find((l) => l.attributes.budget_id === editId));
  const editBill = $derived(bills.data?.find((b) => b.id === editId));
  const editPiggy = $derived(piggies.data?.find((p) => p.id === editId));

  const billTotal = $derived(billRows.reduce((s, b) => s + b.amount, 0));
  const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
</script>

<svelte:head><title>Control · Dragonfly</title></svelte:head>

<div class="tabs" role="tablist">
  {#each TABS as t, i (t.id)}
    <button aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => open(t.id)} role="tab">
      {t.label}<kbd>{i + 1}</kbd>
    </button>
  {/each}
</div>

{#if tab === "budgets"}
  {#if budgets.isPending || txs.isPending || !view.ready || Array.isArray(budgetRows)}
    <div class="skeleton" style="height: 360px"></div>
  {:else}
    <div class="head">
      <div>
        <div class="small">{periodName(period.start, period.end)} · {left} days left</div>
        {#if budgetRows.list.length}
          {@const spent = budgetRows.list.reduce((s, b) => s + b.spent, 0)}
          {@const limit = budgetRows.list.reduce((s, b) => s + b.limit, 0)}
          <div class="total"><span class:neg={limit > 0 && spent > limit}>{view.show(spent, { decimals: 0 })}</span><span class="of">of {view.show(limit, { decimals: 0 })} budgeted</span></div>
        {/if}
      </div>
      <button class="btn primary" onclick={() => edit("budget")} type="button"><Plus size={15} />New budget</button>
    </div>
    <div class="budgets">
      {#each budgetRows.list as b (b.id)}
        {@const l = look.of("budget", b.id, b.name)}
        {@const ratio = b.limit ? b.spent / b.limit : 0}
        {@const state = ratio > 1 ? "over" : ratio > elapsed ? "ahead" : "fine"}
        <section class="panel budget">
          <div class="b-head">
            <Chip color={l.color} icon={l.icon} size={44} />
            <div class="b-name">
              <a class="title link" href="/tx?budget={b.id}">{b.name}</a>
              <div class="small" class:neg={state === "over"} class:warn={state === "ahead"}>
                {#if !b.limit}
                  no limit this period
                {:else if state === "over"}
                  over by {view.show(b.spent - b.limit, { decimals: 0 })}
                {:else if state === "ahead"}
                  spending faster than the month goes · {view.show(b.limit - b.spent, { decimals: 0 })} left
                {:else}
                  on track · {view.show(b.limit - b.spent, { decimals: 0 })} left, {view.show((b.limit - b.spent) / Math.max(1, left), { decimals: 0 })} a day
                {/if}
              </div>
            </div>
            <div class="b-sum">
              <span class="big" class:neg={state === "over"} data-copy>{view.show(b.spent, { decimals: 0 })}</span>
              {#if b.limit}<span class="small">of {view.show(b.limit, { decimals: 0 })}</span>{/if}
            </div>
            <button aria-label="Edit {b.name}" class="ib pen" onclick={() => edit("budget", b.id)} title="Edit" type="button"><Pencil size={15} /></button>
          </div>
          {#if b.limit}
            <div class="meter" class:over={state === "over"} class:ahead={state === "ahead"} style:--pace="{Math.min(1, elapsed) * 100}%">
              <span class="small pace-label">today</span>
              <div style:width="{Math.min(1, ratio) * 100}%"></div>
            </div>
          {/if}
          {#if b.cats.length}
            <div class="cats">
              {#each b.cats as c (c.id ?? "none")}
                {@const cl = look.of("category", c.id, c.name)}
                <a class="cat" href="/tx?budget={b.id}&category={c.id ?? 'none'}">
                  <Chip color={cl.color} icon={cl.icon} size={26} radius={8} />
                  <span class="cat-name">{c.name}</span>
                  <span class="cat-bar"><i style:width="{(c.value / b.spent) * 100}%" style:background={cl.color}></i></span>
                  <span class="cat-sum">{view.show(c.value, { decimals: 0 })}</span>
                  <ChevronRight class="go" size={15} />
                </a>
              {/each}
            </div>
          {/if}
        </section>
      {:else}
        <section class="panel empty">No budgets yet. <button class="link plain" onclick={() => edit("budget")} type="button">Create one</button></section>
      {/each}
      {#if budgetRows.outside > 0}
        <section class="panel budget outside">
          <div class="b-head">
            <span class="dashed-chip"></span>
            <div class="b-name">
              <div class="title">Not in a budget</div>
              <div class="small">everything else you spent</div>
            </div>
            <div class="b-sum"><span class="big">{view.show(budgetRows.outside, { decimals: 0 })}</span></div>
          </div>
          <div class="cats">
            {#each budgetRows.outsideCats.slice(0, 8) as c (c.id ?? "none")}
              {@const cl = look.of("category", c.id, c.name)}
              <a class="cat" href="/tx?category={c.id ?? 'none'}&type=withdrawal">
                <Chip color={cl.color} icon={cl.icon} size={26} radius={8} />
                <span class="cat-name">{c.name}</span>
                <span class="cat-bar"><i style:width="{(c.value / budgetRows.outside) * 100}%" style:background={cl.color}></i></span>
                <span class="cat-sum">{view.show(c.value, { decimals: 0 })}</span>
                <ChevronRight class="go" size={15} />
              </a>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/if}
{:else if tab === "subscriptions"}
  {#if bills.isPending || !view.ready}
    <div class="skeleton" style="height: 360px"></div>
  {:else}
    <div class="head">
      <div>
        <div class="small">{periodName(period.start, period.end)}</div>
        <div class="total">{view.show(billTotal, { decimals: 0 })}<span class="of">{billRows.filter((b) => b.paid.length).length} of {billRows.length} paid</span></div>
      </div>
      <button class="btn primary" onclick={() => edit("bill")} type="button"><Plus size={15} />New subscription</button>
    </div>
    <div class="subs">
      {#if calendar}
        <section class="panel cal">
          <div class="week">{#each WEEK as w (w)}<span>{w}</span>{/each}</div>
          <div class="grid">
            {#each calendar as date, i (i)}
              {#if date}
                {@const items = billsOn(date)}
                <div class="day" class:today={date === now} class:past={date < now}>
                  <span class="num">{Number(date.slice(8))}</span>
                  {#each items as item (item.bill.id + item.state)}
                    {@const bl = look.of("bill", item.bill.id, item.bill.name)}
                    <a class="pill {item.state}" href="/tx?bill={item.bill.id}" style:--c={bl.color}>
                      {#if item.state === "paid"}<Check size={12} strokeWidth={3} />{/if}
                      <span>{item.bill.name}</span>
                    </a>
                  {/each}
                </div>
              {:else}
                <div class="day blank"></div>
              {/if}
            {/each}
          </div>
          {#if later.length}
            <div class="small later">
              Next period: {#each later as b, i (b.id)}{i ? " · " : ""}{b.name} {shortDate(b.due.find((d) => d > period.end) ?? "")}{/each}
            </div>
          {/if}
        </section>
      {/if}
      <section class="panel list">
        {#each billRows as b (b.id)}
          {@const bl = look.of("bill", b.id, b.name)}
          <a class="bill" href="/tx?bill={b.id}">
            <Chip color={bl.color} icon={bl.icon} size={40} />
            <div class="b-name">
              <div class="title">{b.name}</div>
              <div class="small" class:neg={b.overdue}>
                {#if b.paid.length}
                  <span class="pos">paid {shortDate(b.paid[0].date)}</span>
                {:else if b.next}
                  {b.overdue ? "overdue since" : "due"} {shortDate(b.next)}{!b.overdue && b.next > now ? ` · in ${daysBetween(now, b.next)} day${daysBetween(now, b.next) === 1 ? "" : "s"}` : ""}
                {/if}
              </div>
            </div>
            <div class="b-sum">
              <b data-copy>{view.each(b.amount, b.orig, b.code)}</b>
              <span class="small">{view.foreign(b.code) ? money(b.orig, b.code) : b.repeat}</span>
            </div>
            <button aria-label="Edit {b.name}" class="ib pen" onclick={(e) => (e.preventDefault(), edit("bill", b.id))} title="Edit" type="button"><Pencil size={15} /></button>
          </a>
        {:else}
          <p class="empty">No subscriptions yet.</p>
        {/each}
      </section>
    </div>
  {/if}
{:else}
  {#if piggies.isPending}
    <div class="skeleton" style="height: 300px"></div>
  {:else}
    <div class="head">
      <div>
        <div class="small">Saved in piggy banks</div>
        <div class="total">{view.show(piggyRows.reduce((s, p) => s + (view.conv(p.current, p.code) ?? 0), 0), { decimals: 0 })}<span class="of">of {view.show(piggyRows.reduce((s, p) => s + (view.conv(p.target, p.code) ?? 0), 0), { decimals: 0 })}</span></div>
      </div>
      <button class="btn primary" onclick={() => edit("piggy")} type="button"><Plus size={15} />New piggy bank</button>
    </div>
    <div class="piggies">
      {#each piggyRows as p (p.id)}
        {@const pl = look.of("piggy", p.id, p.name)}
        {@const ratio = p.target ? Math.min(1, p.current / p.target) : 0}
        <section class="panel piggy">
          <svg class="donut" viewBox="0 0 120 120">
            <circle cx="60" cy="60" fill="none" r="50" stroke="var(--track)" stroke-width="12" />
            <circle cx="60" cy="60" fill="none" r="50" stroke={pl.color} stroke-dasharray="{2 * Math.PI * 50 * ratio} 999" stroke-linecap="round" stroke-width="12" transform="rotate(-90 60 60)" />
          </svg>
          <div class="donut-text">
            <div class="big">{Math.round(ratio * 100)}%</div>
          </div>
          <div class="p-name"><Chip color={pl.color} icon={pl.icon} size={26} radius={8} />{p.name}</div>
          <div class="p-sum">{money(p.current, p.code, { decimals: 0 })} <span class="small">of {money(p.target, p.code, { decimals: 0 })}</span></div>
          <div class="small p-meta">
            {#if p.account}in <a class="link" href="/acc/{p.account.account_id}">{p.account.name}</a>{/if}
            {#if p.end} · by {shortDate(p.end)} {p.end.slice(0, 4)}{/if}
          </div>
          {#if p.monthly}<div class="small p-meta">put away {money(p.monthly, p.code, { decimals: 0 })} a month to make it</div>{/if}
          <div class="p-actions">
            <button class="btn" onclick={() => moneyFor(p.id, "add")} type="button"><Plus size={15} />Put in</button>
            <button class="btn" onclick={() => moneyFor(p.id, "remove")} type="button"><Minus size={15} />Take out</button>
            <button aria-label="Edit {p.name}" class="ib" onclick={() => edit("piggy", p.id)} title="Edit" type="button"><Pencil size={15} /></button>
          </div>
        </section>
      {:else}
        <section class="panel empty">No piggy banks yet.</section>
      {/each}
    </div>
  {/if}
{/if}

<BudgetForm bind:open={budgetOpen} budget={editBudget} limit={editLimit} />
<BillForm bill={editBill} bind:open={billOpen} />
<PiggyForm bind:open={piggyOpen} piggy={editPiggy} />
{#if editPiggy}<PiggyMoney bind:mode={moneyMode} bind:open={moneyOpen} piggy={editPiggy} />{/if}

<style>
  .tabs {
    display: inline-flex;
    padding: 4px;
    border-radius: 13px;
    background: var(--sunk);
    margin-bottom: 26px;
  }
  .tabs button {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: none;
    font-size: 14px;
    font-weight: 700;
    color: var(--mute);
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--panel);
    color: var(--ink);
    box-shadow: 0 1px 3px #0000001f;
  }
  .tabs kbd {
    font-size: 10px;
    padding: 0 5px;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .total {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.03em;
    margin-top: 4px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .of {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--mute);
  }
  .warn {
    color: var(--warn);
  }
  .empty {
    padding: 50px;
    text-align: center;
    color: var(--mute);
    font-weight: 600;
  }

  .budgets {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(560px, 1fr));
    gap: 20px;
  }
  .budget {
    padding: 26px;
  }
  .b-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .b-name {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 18px;
    font-weight: 800;
  }
  .pen {
    width: 32px;
    height: 32px;
    border: 0;
    flex: none;
  }
  .plain {
    border: 0;
    background: none;
    cursor: pointer;
    font-weight: 700;
  }
  .b-sum {
    text-align: right;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .b-sum .big {
    font-size: 30px;
  }
  .meter {
    position: relative;
    height: 14px;
    border-radius: 8px;
    background: var(--track);
    margin-top: 38px;
  }
  .meter > div {
    height: 100%;
    border-radius: 8px;
    background: var(--pos);
  }
  .meter.ahead > div {
    background: var(--warn);
  }
  .meter.over > div {
    background: var(--neg);
  }
  .meter::after {
    content: "";
    position: absolute;
    left: var(--pace);
    top: -5px;
    bottom: -5px;
    width: 2px;
    margin-left: -1px;
    border-radius: 2px;
    background: var(--ink);
  }
  .pace-label {
    position: absolute;
    left: var(--pace);
    top: -24px;
    transform: translateX(-50%);
    font-size: 11.5px;
    color: var(--ink);
  }
  .cats {
    margin: 20px -10px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cat {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) 120px 80px 15px;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
  }
  .cat:hover {
    background: var(--hover);
  }
  .cat :global(.go) {
    color: var(--faint);
    opacity: 0;
  }
  .cat:hover :global(.go) {
    opacity: 1;
  }
  .cat-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cat-bar {
    height: 4px;
    border-radius: 3px;
    background: var(--track);
    overflow: hidden;
  }
  .cat-bar i {
    display: block;
    height: 100%;
  }
  .cat-sum {
    text-align: right;
  }
  .dashed-chip {
    width: 44px;
    height: 44px;
    border-radius: 13px;
    border: 2px dashed var(--line);
    flex: none;
  }

  .subs {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 400px;
    gap: 20px;
  }
  .cal {
    padding: 18px;
  }
  .week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: var(--faint);
    padding: 0 4px 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }
  .day {
    min-height: 92px;
    border-radius: 12px;
    background: var(--sunk);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .day.blank {
    background: none;
  }
  .day.past .num {
    color: var(--faint);
  }
  .day.today {
    box-shadow: inset 0 0 0 2px var(--acc);
  }
  .day.today .num {
    color: var(--acc);
  }
  .num {
    font-size: 13px;
    font-weight: 800;
  }
  .pill {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 7px;
    color: #fff;
    background: var(--c);
    min-width: 0;
  }
  .pill span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill.paid {
    background: var(--pos);
  }
  .pill.late {
    background: var(--neg);
  }
  .later {
    margin-top: 14px;
  }
  .list {
    padding: 10px;
  }
  .bill {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px;
    border-radius: 14px;
  }
  .bill:hover {
    background: var(--hover);
  }
  .bill .title {
    font-size: 15px;
  }

  .piggies {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }
  .piggy {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 30px 26px 26px;
    position: relative;
  }
  .donut {
    width: 170px;
    height: 170px;
  }
  .donut-text {
    position: absolute;
    top: 30px;
    height: 170px;
    display: grid;
    place-items: center;
  }
  .donut-text .big {
    font-size: 34px;
  }
  .p-name {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 800;
    margin-top: 18px;
  }
  .p-sum {
    font-size: 22px;
    font-weight: 800;
    margin-top: 8px;
  }
  .p-meta {
    margin-top: 4px;
  }
  .p-actions {
    display: flex;
    gap: 8px;
    margin-top: 20px;
  }
  @media (max-width: 760px) {
    .tabs {
      display: flex;
      margin-bottom: 16px;
    }
    .tabs button {
      flex: 1;
      justify-content: center;
      padding: 0 8px;
      font-size: 13.5px;
      white-space: nowrap;
    }
    .tabs kbd {
      display: none;
    }
    .head {
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 14px;
    }
    .total {
      font-size: 28px;
      flex-wrap: wrap;
      gap: 0 8px;
    }
    .budgets,
    .subs,
    .piggies {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
    .b-sum .big {
      font-size: 24px;
    }
    .meter {
      margin-top: 30px;
    }
    .cat {
      grid-template-columns: 26px minmax(0, 1fr) 56px auto;
      gap: 10px;
      padding: 6px 4px;
    }
    .cat :global(.go) {
      display: none;
    }
    .cal {
      padding: 12px;
    }
    .grid,
    .week {
      gap: 4px;
    }
    .day {
      min-height: 46px;
      padding: 5px;
      border-radius: 9px;
    }
    .num {
      font-size: 11.5px;
    }
    .pill {
      height: 5px;
      padding: 0;
      border-radius: 3px;
    }
    .pill span,
    .pill :global(svg) {
      display: none;
    }
    .bill {
      padding: 10px 6px;
      gap: 12px;
    }
  }
</style>
