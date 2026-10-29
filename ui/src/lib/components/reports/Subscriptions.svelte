<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { contains } from "#lib/dates.js";
  import { formatDate } from "#lib/format.js";
  import { expectedDates } from "#lib/reports/bills.js";
  import { reportQueries } from "#lib/reports/queries.js";
  import { displayMoney, useReport } from "#lib/reports/report.svelte.js";
  import ReportBox from "./ReportBox.svelte";

  const report = useReport();
  const p = $derived(report.params);
  const bills = createQuery(() => reportQueries.bills(p.start, p.end));

  const rows = $derived(
    (bills.data ?? [])
      .map((item) => {
        const a = item.attributes;
        const expected = expectedDates(a, p);
        const paid = (a.paid_dates ?? []).filter(
          (d) => d.date && contains(p, d.date)
        );
        return { a, expected, id: item.id, paid };
      })
      .filter(
        (row) =>
          row.a.active && (row.expected.length > 0 || row.paid.length > 0)
      )
      .sort((x, y) => (x.a.name ?? "").localeCompare(y.a.name ?? ""))
  );
</script>

<ReportBox
  empty={rows.length === 0}
  emptyText="No subscriptions expected or paid in this period."
  id="bills"
  loading={!bills.data}
  title="Subscriptions"
>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-[13px]">
      <thead>
        <tr class="text-[12px] text-cladd-fg-soft">
          <th class="h-7 px-3 text-left font-medium">Name</th>
          <th class="h-7 px-3 text-right font-medium">Minimum amount</th>
          <th class="h-7 px-3 text-right font-medium">Maximum amount</th>
          <th class="h-7 px-3 text-left font-medium">Expected on</th>
          <th class="h-7 px-3 text-left font-medium">Paid</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          {@const code = row.a.currency_code ?? ""}
          <tr
            class="border-cladd-outline border-t align-top hover:bg-row-hover"
          >
            <td class="max-w-[16rem] truncate px-3 py-1">
              <a class="hover:underline" href="/subscriptions/show/{row.id}"
                >{row.a.name}</a
              >
            </td>
            <td class="num px-3 py-1 text-right">
              {displayMoney(code, Number(row.a.amount_min ?? 0))}
            </td>
            <td class="num px-3 py-1 text-right">
              {displayMoney(code, Number(row.a.amount_max ?? 0))}
            </td>
            <td class="num px-3 py-1 text-cladd-fg-soft">
              {row.expected.map((d) => formatDate(d, "short")).join(", ")}
            </td>
            <td class="px-3 py-1">
              {#each row.paid as paid (paid.transaction_journal_id)}
                <div class="flex gap-2">
                  <a
                    class="num hover:underline"
                    href="/transactions/show/{paid.transaction_group_id}"
                    >{formatDate(paid.date, "short")}</a
                  >
                  <span class="num text-expense"
                    >{displayMoney(
                      paid.currency_code ?? code,
                      -Number(paid.amount ?? 0)
                    )}</span
                  >
                </div>
              {:else}
                <span class="text-cladd-fg-soft">Not charged (yet)</span>
              {/each}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</ReportBox>
