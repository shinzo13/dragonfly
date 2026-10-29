<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { isDebt, owed, stance } from "#lib/accounts/ledger.js";
  import { editUrl, showUrl } from "#lib/components/accounts/links.js";
  import Box from "#lib/components/Box.svelte";
  import { useColumn } from "#lib/dashboard/column.svelte.js";
  import { formatMoney } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period } from "#lib/period.svelte.js";
  import { goto } from "$app/navigation";
  import { accountsQuery, byCurrency } from "./data.js";

  const liabilities = createQuery(() => ({
    ...accountsQuery("liabilities", period.start, period.end),
    placeholderData: keepPreviousData,
  }));

  const groups = $derived(
    byCurrency(
      (liabilities.data ?? []).filter(
        (a) => isDebt(a) && stance(a.attributes) !== "settled"
      ),
      (a) => a.attributes.currency_code ?? ""
    ).map(([code, list]) => {
      const first = list[0].attributes;
      const cur = {
        code,
        decimals: first.currency_decimal_places ?? 2,
        symbol: first.currency_symbol ?? code,
      };
      const rows = list
        .map((a) => ({
          id: a.id,
          key: `debt-${a.id}`,
          name: a.attributes.name,
          value: owed(a.attributes),
        }))
        .sort((x, y) => y.value - x.value);
      return {
        code,
        cur,
        largest: Math.max(...rows.map((r) => Math.abs(r.value))),
        net: rows.reduce((s, r) => s + r.value, 0),
        rows,
      };
    })
  );

  const nets = $derived.by(() => {
    const total = display.total(
      groups.map((g) => ({ ...g.cur, amount: g.net }))
    );
    if (total === null) {
      return groups.map((g) => ({
        code: g.code,
        net: g.net,
        text: formatMoney({ ...g.cur, amount: Math.abs(g.net) }),
      }));
    }
    const text = formatMoney({ ...total, amount: Math.abs(total.amount) });
    return [
      {
        code: "all",
        net: total.amount,
        text: total.converted ? `≈${text}` : text,
      },
    ];
  });

  const column = useColumn(4, () =>
    groups.flatMap((g) =>
      g.rows.map((r) => ({
        edit: () => goto(editUrl(r.id)),
        key: r.key,
        open: () => goto(showUrl(r.id)),
      }))
    )
  );
</script>

{#snippet more()}
  <a
    class="text-brand hover:underline dark:text-(--ff-series-1)"
    href="/accounts/liabilities"
    >See your liabilities</a
  >
{/snippet}

{#if groups.length > 0}
  <Box body="p-0" footer={more} href="/accounts/liabilities" title="Debts">
    <div
      class="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 transition-opacity {liabilities.isPlaceholderData
        ? "opacity-60"
        : ""}"
    >
      {#each nets as g (g.code)}
        {#if g.net !== 0}
          <span class="text-[12px] text-cladd-fg-soft"
            ><span
              class="num font-semibold text-[15px] {g.net > 0
                ? "text-income"
                : "text-expense"}"
              >{g.text}</span
            >
            {g.net > 0 ? "owed to you" : "owed by you"}</span
          >
        {/if}
      {/each}
    </div>
    <table class="w-full border-collapse text-[13px]">
      {#each groups as g (g.code)}
        <tbody class="border-cladd-outline border-t">
          {#each g.rows as r, i (r.key)}
            <tr
              class="h-7 {i > 0
                ? "border-cladd-outline/60 border-t"
                : ""} {column.rowClass(r.key)}"
              id={column.id(r.key)}
              onclick={() => column.point(r.key)}
            >
              <td class="w-full max-w-0 pl-3">
                <a
                  class="block truncate text-cladd-fg hover:underline"
                  href={showUrl(r.id)}
                  title={r.name}
                  >{r.name}</a
                >
              </td>
              <td class="px-2">
                <div
                  class="flex h-1.5 w-16 overflow-hidden rounded-full bg-cladd-surface-next"
                >
                  <span
                    class="h-full rounded-full {r.value > 0
                      ? "bg-income"
                      : "bg-expense"}"
                    style:width="{(Math.abs(r.value) / g.largest) * 100}%"
                  ></span>
                </div>
              </td>
              <td
                class="num whitespace-nowrap pr-3 pl-2 text-right font-medium {r.value >
                0
                  ? "text-income"
                  : "text-expense"}"
              >
                {formatMoney({ amount: r.value, ...g.cur }, true)}
              </td>
            </tr>
          {/each}
        </tbody>
      {/each}
    </table>
  </Box>
{/if}
