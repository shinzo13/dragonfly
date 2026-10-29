export interface LinePoint {
  x: string;
  y: number;
}

export interface LineSeries {
  area?: boolean;
  color?: string;
  format?: (value: number) => string;
  key: string;
  label: string;
  points: LinePoint[];
  strong?: boolean;
}

export interface Bar {
  color?: string;
  format?: (value: number) => string;
  href?: string;
  key: string;
  label: string;
  note?: string;
  value: number;
}

export interface StackKey {
  color: string;
  key: string;
  label: string;
}

export interface StackRow {
  color?: string;
  format?: (value: number) => string;
  href?: string;
  key: string;
  label: string;
  note?: string;
  values: Record<string, number>;
}

export interface Lane {
  axisFormat?: (value: number) => string;
  dots?: Record<string, number>;
  format: (value: number) => string;
  height?: number;
  key: string;
  keys: StackKey[];
  label: string;
  rows: StackRow[];
  typical?: number | null;
}

export interface MeterSegment {
  color?: string;
  label?: string;
  value: number;
}

export interface LegendItem {
  color: string;
  hidden?: boolean;
  key: string;
  label: string;
  shape?: "line" | "rect";
  value?: string;
}

export type Side = "top" | "bottom" | "left" | "right";

const PALETTE_SIZE = 8;

export const OTHER_COLOR = "var(--cladd-fg-softest)";

export const tones = {
  expense: "var(--ff-expense)",
  income: "var(--ff-income)",
  transfer: "var(--ff-transfer)",
  warn: "var(--ff-warn)",
};

export function seriesColor(index: number): string {
  return index < PALETTE_SIZE ? `var(--ff-series-${index + 1})` : OTHER_COLOR;
}

export function wash(color: string, amount = 18): string {
  return `color-mix(in oklch, ${color} ${amount}%, transparent)`;
}

export function utc(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const crisp = (value: number) => Math.round(value) + 0.5;

export function textWidth(text: string, px = 6.6): number {
  return text.length * px;
}

export function roundedBar(
  x: number,
  y: number,
  w: number,
  h: number,
  side: Side,
  radius = 4
): string {
  const across = side === "top" || side === "bottom" ? w : h;
  const along = side === "top" || side === "bottom" ? h : w;
  const r = Math.max(0, Math.min(radius, across / 2, along));
  const arc = (tx: number, ty: number) => `A${r},${r} 0 0 1 ${tx},${ty}`;
  const right = x + w;
  const bottom = y + h;
  switch (side) {
    case "top":
      return `M${x},${bottom}V${y + r}${arc(x + r, y)}H${right - r}${arc(right, y + r)}V${bottom}Z`;
    case "bottom":
      return `M${right},${y}V${bottom - r}${arc(right - r, bottom)}H${x + r}${arc(x, bottom - r)}V${y}Z`;
    case "right":
      return `M${x},${y}H${right - r}${arc(right, y + r)}V${bottom - r}${arc(right - r, bottom)}H${x}Z`;
    default:
      return `M${right},${bottom}H${x + r}${arc(x, bottom - r)}V${y + r}${arc(x + r, y)}H${right}Z`;
  }
}

export interface Segment {
  color: string;
  from: number;
  key: string;
  label: string;
  outer: boolean;
  to: number;
  value: number;
}

export function stack(
  row: StackRow,
  keys: StackKey[]
): { segments: Segment[]; positive: number; negative: number } {
  let positive = 0;
  let negative = 0;
  const segments: Segment[] = [];
  for (const key of keys) {
    const value = row.values[key.key] ?? 0;
    if (value === 0) {
      continue;
    }
    const from = value > 0 ? positive : negative;
    const to = from + value;
    if (value > 0) {
      positive = to;
    } else {
      negative = to;
    }
    segments.push({
      color: (keys.length === 1 && row.color) || key.color,
      from,
      key: key.key,
      label: key.label,
      outer: false,
      to,
      value,
    });
  }
  const lastUp = segments.findLast((s) => s.value > 0);
  const lastDown = segments.findLast((s) => s.value < 0);
  for (const s of segments) {
    s.outer = s === lastUp || s === lastDown;
  }
  return { negative, positive, segments };
}

export function moveIndex(
  key: string,
  index: number,
  count: number,
  axis: "x" | "y" = "x"
): number | null {
  const back = axis === "x" ? "ArrowLeft" : "ArrowUp";
  const forward = axis === "x" ? "ArrowRight" : "ArrowDown";
  const start = index < 0 ? count : index;
  switch (key) {
    case back:
      return Math.max(0, start - 1);
    case forward:
      return Math.min(count - 1, index + 1);
    case "PageUp":
      return Math.max(0, start - 7);
    case "PageDown":
      return Math.min(count - 1, index + 7);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
