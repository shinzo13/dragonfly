<script lang="ts">
  import { percent } from "#lib/format.js";
  import { type Flow, flowValue, keys } from "#lib/reports/flows.js";
  import {
    drillQuery,
    modeLabel,
    money,
    navigate,
    useReport,
  } from "#lib/reports/report.svelte.js";
  import CurrencySwitch from "./CurrencySwitch.svelte";
  import ReportBox from "./ReportBox.svelte";

  let { switcher = false }: { switcher?: boolean } = $props();

  const LEFT_MAX = 5;
  const RIGHT_MAX = 9;
  const SLOT = 34;
  const BAR = 10;
  const CORE = 14;
  const CORE_HEIGHT = 260;
  const GAP = 4;
  const CENT = 0.01;

  interface Node {
    color: string;
    dir: 1 | -1;
    drillable: boolean;
    key: string;
    label: string;
    value: number;
  }

  const report = useReport();
  const mode = $derived(report.mode);
  let width = $state(0);

  function side(flows: Flow[], dir: 1 | -1, max: number): Node[] {
    const sums = new Map<string, { label: string; value: number }>();
    for (const flow of flows) {
      const value = flowValue(flow, mode);
      if (flow.dir !== dir || value === null) {
        continue;
      }
      const key = keys.category(flow);
      const entry = sums.get(key.key) ?? { label: key.label, value: 0 };
      entry.value += value;
      sums.set(key.key, entry);
    }
    const sorted = [...sums.entries()]
      .map(([key, entry]) => ({ key, ...entry }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);
    const color = dir === 1 ? "var(--ff-income)" : "var(--ff-expense)";
    const head: Node[] = sorted.slice(0, max).map((entry) => ({
      color,
      dir,
      drillable: true,
      key: entry.key,
      label: entry.label,
      value: entry.value,
    }));
    const rest = sorted.slice(max);
    if (rest.length > 0) {
      head.push({
        color: "var(--cladd-fg-softest)",
        dir,
        drillable: false,
        key: `other-${dir}`,
        label: `Other (${rest.length})`,
        value: rest.reduce((sum, entry) => sum + entry.value, 0),
      });
    }
    return head;
  }

  const net = $derived.by(() => {
    const sums = new Map<string, number>();
    for (const swap of report.exchanges) {
      if (swap.to === mode) {
        sums.set(swap.from, (sums.get(swap.from) ?? 0) + swap.toAmount);
      }
      if (swap.from === mode) {
        sums.set(swap.to, (sums.get(swap.to) ?? 0) - swap.fromAmount);
      }
    }
    return [...sums.entries()].filter(([, value]) => value !== 0);
  });

  function swaps(dir: 1 | -1): Node[] {
    return net
      .filter(([, value]) => Math.sign(value) === dir)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([code, value]) => ({
        color: "var(--ff-transfer)",
        dir,
        drillable: false,
        key: `swap-${dir}-${code}`,
        label: dir === 1 ? `Exchanged from ${code}` : `Exchanged to ${code}`,
        value: Math.abs(value),
      }));
  }

  function cover(nodes: Node[], gap: number): [Node[], number] {
    let rest = gap;
    const used: Node[] = [];
    for (const node of nodes) {
      const value = Math.min(node.value, rest);
      if (value >= CENT) {
        used.push({ ...node, value });
        rest -= value;
      }
    }
    return [used, rest];
  }

  const model = $derived.by(() => {
    const flows = report.flows ?? [];
    const left = side(flows, 1, LEFT_MAX);
    const right = side(flows, -1, RIGHT_MAX);
    const totalIn = left.reduce((sum, n) => sum + n.value, 0);
    const totalOut = right.reduce((sum, n) => sum + n.value, 0);
    const exchange = mode !== "pc";
    if (totalOut - totalIn >= CENT) {
      const [used, rest] = exchange
        ? cover(swaps(1), totalOut - totalIn)
        : [[], totalOut - totalIn];
      left.push(...used);
      if (rest >= CENT) {
        left.push({
          color: "var(--ff-warn)",
          dir: -1,
          drillable: false,
          key: "deficit",
          label: "From balance",
          value: rest,
        });
      }
    } else if (totalIn - totalOut >= CENT) {
      const [used, rest] = exchange
        ? cover(swaps(-1), totalIn - totalOut)
        : [[], totalIn - totalOut];
      right.push(...used);
      if (rest >= CENT) {
        right.push({
          color: "var(--ff-series-1)",
          dir: 1,
          drillable: false,
          key: "kept",
          label: "Left over",
          value: rest,
        });
      }
    }
    return { left, right, total: Math.max(totalIn, totalOut) };
  });

  const narrow = $derived(width < 640);
  const labelWidth = $derived(Math.min(220, Math.max(110, width * 0.27)));
  const scale = $derived(model.total > 0 ? CORE_HEIGHT / model.total : 0);
  const slotOf = (n: Node) => Math.max(SLOT, n.value * scale + GAP * 2);
  const height = $derived(
    Math.max(
      CORE_HEIGHT + 20,
      model.left.reduce((s, n) => s + slotOf(n), 0),
      model.right.reduce((s, n) => s + slotOf(n), 0)
    )
  );
  const leftX = $derived(labelWidth);
  const rightX = $derived(width - labelWidth - BAR);
  const coreX = $derived((leftX + BAR + rightX) / 2 - CORE / 2);
  const coreTop = $derived((height - model.total * scale) / 2);

  function layout(nodes: Node[]) {
    const used = nodes.reduce((s, n) => s + slotOf(n), 0);
    let y = (height - used) / 2;
    let core = coreTop;
    return nodes.map((node) => {
      const slot = slotOf(node);
      const h = Math.max(1.5, node.value * scale);
      const top = y + (slot - h) / 2;
      const placed = { center: y + slot / 2, core, h, node, top };
      y += slot;
      core += node.value * scale;
      return placed;
    });
  }

  const left = $derived(layout(model.left));
  const right = $derived(layout(model.right));

  function ribbon(x0: number, y0: number, x1: number, y1: number, h: number) {
    const mid = (x0 + x1) / 2;
    return `M${x0},${y0}C${mid},${y0} ${mid},${y1} ${x1},${y1}V${y1 + h}C${mid},${y1 + h} ${mid},${y0 + h} ${x0},${y0 + h}Z`;
  }

  function open(node: Node) {
    if (!node.drillable) {
      return;
    }
    const { key } = node;
    const current = report.drill;
    const same =
      current?.box === "flow" &&
      current.key === key &&
      current.dir === node.dir;
    navigate(
      drillQuery(
        same
          ? null
          : {
              box: "flow",
              dim: "category",
              dir: node.dir,
              key,
              label: `${node.dir === 1 ? "Income" : "Expenses"}: ${node.label}`,
            }
      )
    );
  }

  const share = (n: Node) =>
    model.total ? percent(n.value / model.total) : "";
</script>

<ReportBox
  body="p-3"
  empty={model.total === 0}
  emptyText="No money moved in {modeLabel(mode)} in this period."
  id="flow"
  loading={!report.flows}
  title="Where the money went ({modeLabel(mode)})"
>
  {#snippet tools()}
    {#if switcher}
      <CurrencySwitch />
    {/if}
  {/snippet}
  <div bind:clientWidth={width}>
    {#if width > 0 && narrow}
      <div class="grid gap-4 sm:grid-cols-2">
        {#each [
          { list: model.left, title: "In" },
          { list: model.right, title: "Out" },
        ] as column (column.title)}
          <div>
            <h3 class="mb-1 font-semibold text-[12px] text-cladd-fg-soft">
              {column.title}
            </h3>
            {#each column.list as node (node.key)}
              <button
                class="grid h-7 w-full grid-cols-[0.5rem_1fr_auto_2.5rem] items-center gap-2 rounded-cladd-sm px-1 text-left hover:bg-row-hover disabled:hover:bg-transparent"
                disabled={!node.drillable}
                onclick={() => open(node)}
                type="button"
              >
                <span
                  class="size-2 rounded-full"
                  style:background={node.color}
                ></span>
                <span class="truncate">{node.label}</span>
                <span class="num">{money(mode, node.value)}</span>
                <span class="num text-right text-cladd-fg-soft"
                  >{share(node)}</span
                >
              </button>
            {/each}
          </div>
        {/each}
      </div>
    {:else if width > 0}
      <div class="relative" style:height="{height}px">
        <svg aria-hidden="true" class="absolute inset-0" {height} {width}>
          {#each left as item (item.node.key)}
            <path
              d={ribbon(leftX + BAR, item.top, coreX, item.core, item.h)}
              fill="color-mix(in oklch, {item.node.color} 22%, transparent)"
            />
            <rect
              fill={item.node.color}
              height={item.h}
              rx="2"
              width={BAR}
              x={leftX}
              y={item.top}
            />
          {/each}
          {#each right as item (item.node.key)}
            <path
              d={ribbon(coreX + CORE, item.core, rightX, item.top, item.h)}
              fill="color-mix(in oklch, {item.node.color} 22%, transparent)"
            />
            <rect
              fill={item.node.color}
              height={item.h}
              rx="2"
              width={BAR}
              x={rightX}
              y={item.top}
            />
          {/each}
          <rect
            fill="var(--cladd-fg-soft)"
            height={model.total * scale}
            rx="3"
            width={CORE}
            x={coreX}
            y={coreTop}
          />
        </svg>
        <span
          class="num absolute -translate-x-1/2 font-semibold text-[12px]"
          style:left="{coreX + CORE / 2}px"
          style:top="{coreTop - 22}px"
          >{money(mode, model.total)}</span
        >
        {#each [
          ...left.map((item) => ({ ...item, isLeft: true })),
          ...right.map((item) => ({ ...item, isLeft: false })),
        ] as item (`${item.isLeft}-${item.node.key}`)}
          {@const active =
            report.drill?.box === "flow" &&
            report.drill.key === item.node.key &&
            report.drill.dir === item.node.dir}
          <button
            class="absolute flex h-8 flex-col justify-center rounded-cladd-sm px-1 leading-tight hover:bg-row-hover disabled:hover:bg-transparent {item.isLeft
              ? "items-end text-right"
              : "items-start text-left"} {active ? "bg-row-selected" : ""}"
            disabled={!item.node.drillable}
            onclick={() => open(item.node)}
            title={item.node.drillable
              ? `Show transactions for ${item.node.label}`
              : undefined}
            type="button"
            style:left="{item.isLeft ? 0 : rightX + BAR + 4}px"
            style:top="{item.center - 16}px"
            style:width="{labelWidth - 6}px"
          >
            <span
              class="max-w-full truncate text-[12px] {active
                ? "font-semibold"
                : ""}"
              >{item.node.label}</span
            >
            <span class="num text-[11px] text-cladd-fg-soft"
              >{money(mode, item.node.value)}
              · {share(item.node)}</span
            >
          </button>
        {/each}
      </div>
    {/if}
  </div>
</ReportBox>
