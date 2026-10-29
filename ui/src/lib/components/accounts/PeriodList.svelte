<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import Box from "#lib/components/Box.svelte";
  import { tones } from "#lib/components/charts/chart.js";
  import {
    type ChartSet,
    currency,
    money,
  } from "#lib/components/dashboard/data.js";
  import {
    isDynamic,
    periodOf,
    type Range,
    shiftPeriod,
    type ViewRange,
  } from "#lib/dates.js";
  import { toNumber } from "#lib/format.js";
  import { display } from "#lib/money/display.svelte.js";
  import { period, periodLabel } from "#lib/period.svelte.js";

  const COUNT = 12;
  const STEPS = new Set(["1D", "1W", "1M", "3M", "6M", "1Y"]);

  let { accountId, code }: { accountId: string; code: string } = $props();

  const view = $derived<ViewRange>(
    isDynamic(period.view) || !STEPS.has(period.view) ? "1M" : period.view
  );
  const blocks = $derived.by<Range[]>(() => {
    const list = [periodOf(period.end, view)];
    for (let i = 1; i < COUNT; i += 1) {
      list.push(shiftPeriod(list[i - 1], view, -1));
    }
    return list;
  });
  const oldest = $derived(blocks.at(-1)?.start ?? period.start);
  const newest = $derived(blocks[0]?.end ?? period.end);

  const flows = createQuery(() => ({
    queryFn: () =>
      api<ChartSet[]>("/v1/chart/balance/balance", {
        query: {
          "accounts[]": accountId,
          end: newest,
          period: view,
          start: oldest,
        },
      }),
    queryKey: ["account-flows", accountId, oldest, newest, view],
  }));

  interface Flow {
    approx?: boolean;
    code: string;
    earned: number;
    spent: number;
  }

  const byStart = $derived.by(() => {
    const map = new Map<string, Flow[]>();
    for (const set of flows.data ?? []) {
      const kind = set.label === "earned" ? "earned" : "spent";
      for (const [date, value] of Object.entries(set.entries)) {
        const key = date.slice(0, 10);
        const list = map.get(key) ?? [];
        let flow = list.find((f) => f.code === set.currency_code);
        if (!flow) {
          flow = { code: set.currency_code, earned: 0, spent: 0 };
          list.push(flow);
          map.set(key, list);
        }
        flow[kind] += Math.abs(toNumber(value));
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => Number(b.code === code) - Number(a.code === code));
    }
    return map;
  });
  const merged = $derived.by(() => {
    if (!display.active) {
      return null;
    }
    const map = new Map<string, Flow[]>();
    for (const [key, list] of byStart) {
      const flow: Flow = { code: display.code, earned: 0, spent: 0 };
      for (const f of list) {
        const rate = display.rate(f.code);
        if (rate === null) {
          return null;
        }
        flow.earned += f.earned * rate;
        flow.spent += f.spent * rate;
        flow.approx ||= f.code !== display.code;
      }
      map.set(key, [flow]);
    }
    return map;
  });
  const shown = $derived(merged ?? byStart);
  const main = $derived(merged ? display.code : code);
  const scale = $derived(
    Math.max(
      1,
      ...[...shown.values()].flatMap((list) =>
        list
          .filter((f) => f.code === main)
          .map((f) => Math.max(f.earned, f.spent))
      )
    )
  );
  const isCurrent = (block: Range) =>
    block.start === period.start && block.end === period.end;
</script>

<Box body="p-0 @container" title="Periods">
  <ul
    class="-mr-px grid grid-cols-1 overflow-hidden @xs:grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-6"
  >
    {#each blocks as block (block.start)}
      {@const list = (shown.get(block.start) ?? []).filter(
        (f) => f.earned || f.spent
      )}
      <li class="border-cladd-outline/60 border-r border-b">
        <a
          class="flex flex-col gap-1 px-3 py-2 hover:bg-row-hover {isCurrent(
            block
          )
            ? "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]"
            : ""}"
          href="/accounts/show/{accountId}/{block.start}/{block.end}"
        >
          <span class="font-semibold text-[12px] text-cladd-fg"
            >{periodLabel(block, view)}</span
          >
          {#if list.length === 0}
            <span class="text-[12px] text-cladd-fg-softer"
              >No transactions</span
            >
          {/if}
          {#each list as flow (flow.code)}
            {@const fmt = money(currency(flow.code))}
            {@const mark = flow.approx ? "≈" : ""}
            <span
              class="num flex flex-wrap justify-between gap-x-2 text-[12px]"
            >
              {#if flow.earned}
                <span class="text-income">{mark}+{fmt(flow.earned)}</span>
              {/if}
              {#if flow.spent}
                <span class="ml-auto text-expense"
                  >{mark}−{fmt(flow.spent)}</span
                >
              {/if}
            </span>
            {#if flow.code === main}
              <span aria-hidden="true" class="flex h-1 gap-0.5">
                <span class="flex flex-1 justify-end">
                  <span
                    class="h-full rounded-l-full"
                    style:background={tones.income}
                    style:width="{(flow.earned / scale) * 100}%"
                  ></span>
                </span>
                <span class="flex-1">
                  <span
                    class="block h-full rounded-r-full"
                    style:background={tones.expense}
                    style:width="{(flow.spent / scale) * 100}%"
                  ></span>
                </span>
              </span>
            {/if}
          {/each}
        </a>
      </li>
    {/each}
  </ul>
</Box>
