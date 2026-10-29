<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import { createQuery } from "@tanstack/svelte-query";
  import {
    type Action,
    actionsFor,
    isDebt,
    movements,
    owed,
    type Stance,
    stance,
  } from "#lib/accounts/ledger.js";
  import { api } from "#lib/api/client.js";
  import { all, lists } from "#lib/api/lists.js";
  import type {
    Account,
    Item,
    Page,
    TransactionGroup,
  } from "#lib/api/types.js";
  import Amount from "#lib/components/Amount.svelte";
  import Box from "#lib/components/Box.svelte";
  import Money from "#lib/components/Money.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { today } from "#lib/dates.js";
  import { formatDate, toNumber } from "#lib/format.js";
  import type { Binding } from "#lib/keys.svelte.js";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { goto } from "$app/navigation";
  import DebtCard from "./DebtCard.svelte";
  import {
    editUrl,
    LIABILITY_LABEL,
    PERIOD_LABEL,
    showUrl,
    TYPE_ONE,
  } from "./links.js";

  const KEYS = { more: "+", offset: "o", repay: "s" };
  const ALIASES = { more: "", offset: "=", repay: "S" };
  const ORDER: Stance[] = ["owed", "owe", "settled"];
  const CREATE = "/accounts/create/liabilities";

  const liabilities = createQuery(() => ({
    queryFn: () =>
      all<Account>("/v1/accounts", {
        active: "true",
        date: today(),
        type: "liabilities",
      }),
    queryKey: ["ledger-accounts"],
  }));
  const inactive = createQuery(() => ({
    queryFn: () =>
      api<Page<Account>>("/v1/accounts", {
        query: { active: "false", limit: 1, type: "liabilities" },
      }),
    queryKey: ["accounts-count", "liabilities", false],
  }));
  const assets = createQuery(() => lists.accounts("asset"));

  const debts = $derived((liabilities.data ?? []).filter(isDebt));
  const others = $derived(
    (liabilities.data ?? []).filter((item) => !isDebt(item))
  );
  const history = createQuery(() => ({
    enabled: debts.length > 0,
    queryFn: async () =>
      new Map(
        await Promise.all(
          debts.map(
            async (item) =>
              [
                item.id,
                movements(
                  item,
                  await all<TransactionGroup>(
                    `/v1/accounts/${item.id}/transactions`
                  )
                ),
              ] as const
          )
        )
      ),
    queryKey: ["ledger-history", debts.map((d) => d.id).join(",")],
  }));

  const rank = (item: Item<Account>) => ORDER.indexOf(stance(item.attributes));
  const lastDate = (item: Item<Account>) =>
    history.data?.get(item.id)?.[0]?.date ?? "";
  const cards = $derived(
    debts.toSorted(
      (x, y) => rank(x) - rank(y) || lastDate(y).localeCompare(lastDate(x))
    )
  );
  const items = $derived([...cards, ...others]);
  const index = $derived(new Map(items.map((item, i) => [item.id, i])));

  const plans = $derived(
    new Map(
      cards.map((item) => [
        item.id,
        history.data && assets.data
          ? actionsFor(
              item,
              history.data.get(item.id) ?? [],
              assets.data,
              debts
            )
          : null,
      ])
    )
  );

  interface Sum {
    code: string;
    decimals: number;
    owe: number;
    owed: number;
    symbol: string;
  }
  const sums = $derived.by(() => {
    const map = new Map<string, Sum>();
    for (const { attributes: a } of debts) {
      const code = a.currency_code ?? "";
      const sum = map.get(code) ?? {
        code,
        decimals: a.currency_decimal_places ?? 2,
        owe: 0,
        owed: 0,
        symbol: a.currency_symbol ?? code,
      };
      const position = owed(a);
      if (position > 0) {
        sum.owed += position;
      } else {
        sum.owe -= position;
      }
      map.set(code, sum);
    }
    return [...map.values()];
  });
  const owedToYou = $derived(sums.filter((s) => s.owed > 0));
  const youOwe = $derived(sums.filter((s) => s.owe > 0));

  function current(): Item<Account> | undefined {
    return nav.current;
  }

  function bind(kind: keyof typeof KEYS, action?: Action | null): Binding[] {
    if (!action) {
      return [];
    }
    const run = () => goto(action.href);
    const main = { group: "Debts", keys: KEYS[kind], label: action.hint, run };
    const alias = ALIASES[kind];
    return alias ? [main, { ...main, hidden: true, keys: alias }] : [main];
  }

  const nav = new ListNav<Item<Account>>({
    edit: (item) => goto(editUrl(item.id)),
    extra: (): Binding[] => {
      const plan = plans.get(current()?.id ?? "");
      return [
        {
          group: "List",
          keys: "Enter",
          label: "Open account",
          run: () => {
            const item = current();
            if (item) {
              goto(showUrl(item.id));
            }
          },
        },
        ...bind("repay", plan?.repay),
        ...bind("more", plan?.more),
        ...bind("offset", plan?.offset),
        {
          group: "Accounts",
          keys: "c",
          label: `Create a new ${TYPE_ONE.liabilities}`,
          run: () => goto(CREATE),
        },
      ];
    },
    id: "ledger",
    items: () => items,
    key: (item) => item.id,
  });
  nav.use();

  function rowClass(i: number) {
    if (nav.cursor === i) {
      return "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]";
    }
    return "hover:bg-row-hover";
  }
</script>

{#snippet totals(
  label: string,
  list: Sum[],
  key: "owe" | "owed"
)}
  <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
    <span class="text-[13px] text-cladd-fg-soft">{label}</span>
    <span class="text-[24px] leading-tight">
      {#if list.length > 0}
        <Money
          class="font-semibold"
          inline
          parts={list.map((sum) => ({ ...sum, amount: sum[key] }))}
          tone={key === "owed" ? "income" : "expense"}
        />
      {:else}
        <span class="num font-semibold text-cladd-fg-soft">0</span>
      {/if}
    </span>
  </div>
{/snippet}

<PageHeader crumbs={[{ label: "Liabilities" }]} title="Accounts">
  {#snippet actions()}
    <a
      class="cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-color-green inline-flex h-cladd-sm items-center gap-1.5 rounded-cladd-sm px-2.5 font-semibold text-[12px] text-cladd-primary"
      href={CREATE}
      title="Create a new liability  c"
    >
      <Plus class="size-3.5" />
      Create a new liability
    </a>
  {/snippet}
</PageHeader>

{#if liabilities.isPending}
  <div class="h-40"></div>
{:else if liabilities.isError}
  <p class="text-expense">{liabilities.error.message}</p>
{:else}
  <div class="flex flex-col gap-3">
    {#if debts.length > 0}
      <section
        class="cladd-surface cladd-outline grid gap-3 rounded-cladd-lg p-3 md:grid-cols-2"
      >
        {@render totals("Owed to you", owedToYou, "owed")}
        {@render totals("You owe", youOwe, "owe")}
      </section>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {#each cards as item (item.id)}
          {@const i = index.get(item.id) ?? -1}
          <DebtCard
            actions={plans.get(item.id) ?? null}
            current={nav.cursor === i}
            id={nav.rowId(i)}
            {item}
            keys={KEYS}
            list={history.data?.get(item.id)}
            onfocusin={() => (nav.cursor = i)}
          />
        {/each}
      </div>
    {:else}
      <div
        class="cladd-surface cladd-outline flex flex-col items-center gap-3 rounded-cladd-lg px-3 py-10 text-center"
      >
        <p class="font-semibold text-[15px]">No debts yet</p>
        <a class="text-brand underline dark:text-(--ff-series-1)" href={CREATE}
          >Create a new liability</a
        >
      </div>
    {/if}

    {#if others.length > 0}
      <Box body="p-0" title="Loans and other liabilities">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-[13px]">
            <thead class="border-cladd-outline border-b text-left">
              <tr class="h-8 text-[12px] text-cladd-fg-soft">
                <th class="px-3 font-semibold" scope="col">Name</th>
                <th class="px-3 font-semibold max-md:hidden" scope="col">
                  Type of liability
                </th>
                <th class="px-3 font-semibold max-md:hidden" scope="col">
                  Interest
                </th>
                <th class="px-3 font-semibold max-md:hidden" scope="col">
                  Last activity
                </th>
                <th class="px-3 text-right font-semibold" scope="col">
                  Amount due
                </th>
              </tr>
            </thead>
            <tbody>
              {#each others as item (item.id)}
                {@const a = item.attributes}
                {@const i = index.get(item.id) ?? -1}
                <tr
                  class="h-7 border-cladd-outline/60 border-t {rowClass(i)}"
                  id={nav.rowId(i)}
                  onclick={(event) => nav.click(i, event)}
                >
                  <td class="px-3">
                    <a
                      class="text-brand hover:underline dark:text-(--ff-series-1)"
                      href={showUrl(item.id)}
                      >{a.name}</a
                    >
                  </td>
                  <td class="px-3 max-md:hidden">
                    {LIABILITY_LABEL[a.liability_type ?? ""] ?? ""}
                  </td>
                  <td class="whitespace-nowrap px-3 max-md:hidden">
                    <span class="num">{toNumber(a.interest)}%</span>
                    <span class="text-cladd-fg-soft"
                      >{PERIOD_LABEL[a.interest_period ?? ""] ??
                        a.interest_period}</span
                    >
                  </td>
                  <td
                    class="whitespace-nowrap px-3 text-cladd-fg-soft max-md:hidden"
                  >
                    {a.last_activity
                      ? formatDate(a.last_activity.slice(0, 10))
                      : "never"}
                  </td>
                  <td class="whitespace-nowrap px-3 text-right">
                    <Amount
                      amount={a.debt_amount}
                      code={a.currency_code}
                      decimals={a.currency_decimal_places}
                      symbol={a.currency_symbol}
                      tone="expense"
                    />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Box>
    {/if}

    {#if (inactive.data?.meta.pagination?.total ?? 0) > 0}
      {@const count = inactive.data?.meta.pagination?.total ?? 0}
      <a
        class="self-start text-[13px] text-cladd-fg-soft hover:underline"
        href="/inactive-accounts/liabilities"
        >{count}
        inactive {count === 1 ? "liability" : "liabilities"}</a
      >
    {/if}
  </div>
{/if}
