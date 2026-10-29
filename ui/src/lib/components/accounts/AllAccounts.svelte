<script lang="ts">
  import { createQuery, keepPreviousData } from "@tanstack/svelte-query";
  import { owed } from "#lib/accounts/ledger.js";
  import { moves, sums } from "#lib/accounts/statement.js";
  import { lists } from "#lib/api/lists.js";
  import type { Account, Item, TransactionGroup } from "#lib/api/types.js";
  import Box from "#lib/components/Box.svelte";
  import { addDays } from "#lib/dates.js";
  import { formatMoney, type Money, toNumber } from "#lib/format.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { display } from "#lib/money/display.svelte.js";
  import { pages, reportQueries } from "#lib/reports/queries.js";
  import { goto } from "$app/navigation";
  import { showUrl, typeOf } from "./links.js";

  interface Line {
    closing: number;
    cur: Omit<Money, "amount">;
    id: string;
    income: number;
    liability: boolean;
    moved: number;
    name: string;
    opening: number;
    other: number;
    rows: number;
    spent: number;
  }

  const CENT = 0.005;
  const NUM = "num whitespace-nowrap text-right";

  let {
    accounts = [],
    start,
    end,
  }: { accounts?: string[]; start: string; end: string } = $props();

  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));
  const balances = createQuery(() => ({
    ...reportQueries.balances(start, end),
    placeholderData: keepPreviousData,
  }));
  const ledger = createQuery(() => ({
    placeholderData: keepPreviousData,
    queryFn: () =>
      pages<TransactionGroup>("/v1/transactions", {
        end: end > start ? end : addDays(start, 1),
        start,
        type: "all",
      }),
    queryKey: ["accounts-audit", start, end],
  }));

  const range = $derived({ end, start });
  const ready = $derived(
    Boolean(assets.data && liabilities.data && balances.data && ledger.data)
  );
  const loading = $derived(
    balances.isPlaceholderData || ledger.isPlaceholderData
  );

  function flip(a: Account): number {
    const debt = owed(a);
    const balance = toNumber(a.current_balance);
    return Math.abs(debt) > CENT && Math.sign(balance) === -Math.sign(debt)
      ? -1
      : 1;
  }

  function lineOf(item: Item<Account>, liability: boolean): Line {
    const a = item.attributes;
    const sign = liability ? flip(a) : 1;
    const { rows, total } = sums(
      moves(item.id, a.currency_code, ledger.data ?? []),
      range
    );
    return {
      closing: sign * (balances.data?.after.get(item.id) ?? 0),
      cur: {
        code: a.currency_code,
        decimals: a.currency_decimal_places,
        symbol: a.currency_symbol,
      },
      id: item.id,
      income: total.income,
      liability,
      moved: total.movedIn + total.movedOut,
      name: a.name,
      opening: sign * (balances.data?.before.get(item.id) ?? 0),
      other: total.opening + total.adjusted,
      rows,
      spent: total.spent,
    };
  }

  const lines = $derived.by(() => {
    if (!ready) {
      return [];
    }
    const chosen = new Set(accounts);
    return [...(assets.data ?? []), ...(liabilities.data ?? [])]
      .filter((item) =>
        chosen.size > 0 ? chosen.has(item.id) : item.attributes.active
      )
      .map((item) => lineOf(item, typeOf(item.attributes) === "liabilities"));
  });
  const byActivity = (x: Line, y: Line) =>
    y.rows - x.rows || x.name.localeCompare(y.name);
  const busy = $derived(lines.filter((l) => l.rows > 0));
  const sections = $derived(
    [
      {
        key: "asset",
        lines: busy.filter((l) => !l.liability).sort(byActivity),
        title: "Asset accounts",
        words: ["Income", "Spent"],
      },
      {
        key: "liability",
        lines: busy.filter((l) => l.liability).sort(byActivity),
        title: "Liabilities",
        words: ["In", "Out"],
      },
    ].filter((s) => s.lines.length > 0)
  );
  const ordered = $derived(sections.flatMap((s) => s.lines));
  const idle = $derived(
    lines
      .filter((l) => l.rows === 0)
      .sort((x, y) => x.name.localeCompare(y.name))
  );
  const adjusted = $derived(lines.some((l) => Math.abs(l.other) > CENT));
  const href = (id: string) => `${showUrl(id)}/${start}/${end}`;

  const nav = new ListNav<Line>({
    id: "all-accounts",
    items: () => ordered,
    key: (line) => line.id,
    open: (line) => goto(href(line.id)),
  });
  nav.use();

  const money = (line: Line, amount: number, signed = false) =>
    display.text([{ ...line.cur, amount }], signed);
  const original = (line: Line, amount: number, signed = false) =>
    display.total([{ ...line.cur, amount }])?.converted
      ? formatMoney({ ...line.cur, amount }, signed)
      : undefined;
  function tone(value: number, positive: string, negative = positive) {
    if (Math.abs(value) < CENT) {
      return "text-cladd-fg-softer";
    }
    return value > 0 ? positive : negative;
  }

  const real = (line: Line, value: number) =>
    line.liability
      ? tone(value, "text-cladd-fg")
      : tone(value, "text-income", "text-expense");
</script>

{#snippet cell(
  line: Line,
  amount: number,
  extra: string,
  signed = true
)}
  <td class="{NUM} {extra}" title={original(line, amount, signed)}>
    {money(line, amount, signed)}
  </td>
{/snippet}

<Box body="p-0 overflow-x-auto" title="Accounts">
  <table
    class="w-full min-w-[38rem] border-collapse md:min-w-[46rem] text-[13px] transition-opacity {loading
      ? "opacity-60"
      : ""}"
  >
    {#each sections as section (section.key)}
      <thead>
        <tr
          class="border-cladd-outline border-b text-left text-[12px] text-cladd-fg-soft [&>th]:h-8 [&>th]:whitespace-nowrap [&>th]:px-2 [&>th]:font-medium {section.key ===
          "liability"
            ? "border-t"
            : ""}"
        >
          <th class="text-cladd-fg">{section.title}</th>
          <th class="w-14 max-md:hidden">Currency</th>
          <th class="w-32 text-right">Opening</th>
          <th class="w-28 text-right">{section.words[0]}</th>
          <th class="w-28 text-right">{section.words[1]}</th>
          <th class="w-28 text-right">Moved</th>
          {#if adjusted}
            <th class="w-28 text-right">Adjusted</th>
          {/if}
          <th class="w-32 text-right">Closing</th>
          <th class="w-14 text-right max-md:hidden">Rows</th>
        </tr>
      </thead>
      <tbody>
        {#each section.lines as line (line.id)}
          {@const index = ordered.indexOf(line)}
          <tr
            class="h-7 border-cladd-outline/60 border-b [&>td]:px-2 {nav.cursor ===
            index
              ? "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]"
              : "hover:bg-row-hover"}"
            id={nav.rowId(index)}
            onclick={(event) => nav.click(index, event)}
          >
            <td class="max-w-0 truncate max-md:min-w-32">
              <a class="hover:underline" href={href(line.id)} title={line.name}
                >{line.name}</a
              >
            </td>
            <td class="text-cladd-fg-soft max-md:hidden">{line.cur.code}</td>
            {@render cell(line, line.opening, "", false)}
            {@render cell(line, line.income, real(line, line.income))}
            {@render cell(line, line.spent, real(line, line.spent))}
            {@render cell(line, line.moved, tone(line.moved, "text-transfer"))}
            {#if adjusted}
              {@render cell(
                line,
                line.other,
                tone(line.other, "text-cladd-fg")
              )}
            {/if}
            {@render cell(line, line.closing, "font-semibold", false)}
            <td class="{NUM} text-cladd-fg-soft max-md:hidden">{line.rows}</td>
          </tr>
        {/each}
      </tbody>
    {/each}
    {#if idle.length > 0}
      <tbody>
        <tr class="text-[12px] text-cladd-fg-softer [&>td]:px-2 [&>td]:py-1.5">
          <td colspan={adjusted ? 9 : 8}>
            No activity:
            {#each idle as line (line.id)}
              <a
                class="hover:text-cladd-fg hover:underline [&:not(:last-child)]:after:content-[',_']"
                href={href(line.id)}
                >{line.name}</a
              >
            {/each}
          </td>
        </tr>
      </tbody>
    {/if}
  </table>
  {#if !ready}
    <p class="px-3 py-6 text-center text-cladd-fg-soft">Loading accounts...</p>
  {:else if lines.length === 0}
    <p class="px-3 py-6 text-center text-cladd-fg-soft">
      No accounts selected.
    </p>
  {/if}
</Box>
