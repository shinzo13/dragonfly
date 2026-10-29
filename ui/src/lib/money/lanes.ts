import type { Lane, StackKey, StackRow } from "#lib/components/charts/chart.js";
import { compactMoney, formatMoney } from "#lib/format.js";
import { display } from "./display.svelte.js";

function addScaled(
  into: Record<string, number>,
  from: Record<string, number> | undefined,
  rate: number
) {
  for (const [key, value] of Object.entries(from ?? {})) {
    into[key] = (into[key] ?? 0) + value * rate;
  }
}

export function mergeLanes(
  lanes: Lane[],
  codeOf: (lane: Lane) => string = (lane) => lane.key
): Lane[] {
  const { code, target } = display;
  const same = lanes.length === 1 && codeOf(lanes[0]) === code;
  if (!display.active || lanes.length === 0 || same) {
    return lanes;
  }
  const rates = lanes.map((lane) => display.rate(codeOf(lane)));
  if (rates.some((rate) => rate === null)) {
    return lanes;
  }
  const keys = new Map<string, StackKey>();
  const rows = new Map<string, StackRow>();
  const dots: Record<string, number> = {};
  let typical = 0;
  for (const [i, lane] of lanes.entries()) {
    const rate = rates[i] ?? 1;
    for (const key of lane.keys) {
      keys.set(key.key, keys.get(key.key) ?? key);
    }
    for (const row of lane.rows) {
      const merged = rows.get(row.key) ?? { ...row, values: {} };
      addScaled(merged.values, row.values, rate);
      rows.set(row.key, merged);
    }
    addScaled(dots, lane.dots, rate);
    typical += (lane.typical ?? 0) * rate;
  }
  const heights = lanes.map((lane) => lane.height);
  return [
    {
      axisFormat: (value: number) => compactMoney(value, target.symbol),
      dots: lanes.some((lane) => lane.dots) ? dots : undefined,
      format: (value: number) =>
        `≈${formatMoney({ ...target, amount: value, decimals: 0 })}`,
      height: heights.includes(undefined)
        ? undefined
        : Math.max(...heights.map((height) => height ?? 0)),
      key: code,
      keys: [...keys.values()],
      label: `≈${code}`,
      rows: [...rows.values()],
      typical: typical || null,
    },
  ];
}
