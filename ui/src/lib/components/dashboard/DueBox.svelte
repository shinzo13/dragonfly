<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { all, lists } from "#lib/api/lists.js";
  import type { Bill } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { useColumn } from "#lib/dashboard/column.svelte.js";
  import { addDays, today } from "#lib/dates.js";
  import { formatDate, toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { goto } from "$app/navigation";
  import { byCurrency, type Cur, rough } from "./data.js";

  const DAYS = 7;
  const HREF = `/subscriptions?horizon=${DAYS}`;

  interface Due {
    amount: number;
    approx: boolean;
    cur: Cur;
    date: string;
    edit: string;
    href: string;
    key: string;
    name: string;
    piggy: boolean;
  }

  const now = today();
  const end = addDays(now, DAYS);
  const inWindow = (value: string | null | undefined) => {
    const day = (value ?? "").slice(0, 10);
    return day >= now && day <= end;
  };

  const bills = createQuery(() => ({
    queryFn: () => all<Bill>("/v1/bills", { end, start: now }),
    queryKey: ["bills-due", now, end],
  }));
  const piggies = createQuery(() => lists.piggyBanks());

  const items = $derived.by<Due[]>(() => {
    const due = (bills.data ?? [])
      .filter((b) => b.attributes.active !== false)
      .flatMap((b) => {
        const a = b.attributes;
        const expected = (a.pay_dates ?? []).filter(inWindow).sort();
        const paid = (a.paid_dates ?? []).filter((p) => inWindow(p.date));
        const min = toNumber(a.amount_min);
        const max = toNumber(a.amount_max);
        return expected.slice(paid.length).map((date) => ({
          amount: (min + max) / 2,
          approx: min !== max,
          cur: {
            code: a.currency_code ?? "",
            decimals: a.currency_decimal_places ?? 2,
            symbol: a.currency_symbol ?? "",
          },
          date: date.slice(0, 10),
          edit: `/subscriptions/edit/${b.id}`,
          href: `/subscriptions/show/${b.id}`,
          key: `due-bill-${b.id}-${date.slice(0, 10)}`,
          name: a.name ?? "",
          piggy: false,
        }));
      });
    const saving = (piggies.data ?? [])
      .filter(
        (p) =>
          p.attributes.active !== false &&
          toNumber(p.attributes.left_to_save) > 0 &&
          inWindow(p.attributes.target_date)
      )
      .map((p) => {
        const a = p.attributes;
        return {
          amount: toNumber(a.left_to_save),
          approx: false,
          cur: {
            code: a.currency_code ?? "",
            decimals: a.currency_decimal_places ?? 2,
            symbol: a.currency_symbol ?? "",
          },
          date: (a.target_date ?? "").slice(0, 10),
          edit: `/piggy-banks/edit/${p.id}`,
          href: `/piggy-banks/show/${p.id}`,
          key: `due-piggy-${p.id}`,
          name: a.name ?? "",
          piggy: true,
        };
      });
    return [...due, ...saving].sort(
      (x, y) => x.date.localeCompare(y.date) || x.name.localeCompare(y.name)
    );
  });

  const totals = $derived(
    byCurrency(items, (i) => i.cur.code).map(([, list]) => ({
      ...list[0].cur,
      amount: list.reduce((s, i) => s + i.amount, 0),
      approx: list.some((i) => i.approx),
    }))
  );

  function dayLabel(date: string) {
    if (date === now) {
      return "Today";
    }
    return date === addDays(now, 1) ? "Tomorrow" : formatDate(date, "day");
  }

  const column = useColumn(3, () =>
    items.map((item) => ({
      edit: () => goto(item.edit),
      key: item.key,
      open: () => goto(item.href),
    }))
  );
</script>

{#snippet more()}
  <a class="text-brand hover:underline dark:text-(--ff-series-1)" href={HREF}
    >Go to your subscriptions</a
  >
{/snippet}

<Box body="p-0" footer={more} href={HREF} title="Next {DAYS} days">
  {#if items.length === 0}
    <p class="px-3 py-2.5 text-[12.5px] text-cladd-fg-soft">
      {bills.isPending ? "" : `Nothing due in the next ${DAYS} days.`}
    </p>
  {:else}
    <div
      class="num flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 font-semibold text-[15px] text-cladd-fg"
    >
      {#if display.total(totals)}
        <span
          >{rough(
            totals,
            totals.some((t) => t.approx)
          )}</span
        >
      {:else}
        {#each totals as t (t.code)}
          <span>{rough([t], t.approx)}</span>
        {/each}
      {/if}
    </div>
    <table class="w-full border-collapse text-[13px]">
      <tbody>
        {#each items as item (item.key)}
          <tr
            class="h-7 border-cladd-outline/60 border-t {column.rowClass(
              item.key
            )}"
            id={column.id(item.key)}
            onclick={() => column.point(item.key)}
          >
            <td class="whitespace-nowrap pr-2 pl-3 text-cladd-fg-soft">
              {dayLabel(item.date)}
            </td>
            <td class="w-full max-w-0">
              <a
                class="block truncate text-cladd-fg hover:underline"
                href={item.href}
                title={item.name}
                >{item.name}<span class="text-cladd-fg-soft"
                  >{item.piggy ? " · piggy bank" : ""}</span
                ></a
              >
            </td>
            <td
              class="num whitespace-nowrap pr-3 pl-2 text-right text-cladd-fg"
            >
              {rough([{ ...item.cur, amount: item.amount }], item.approx)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Box>
