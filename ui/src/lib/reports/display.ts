import { display } from "#lib/money/display.svelte.js";
import type { Flow } from "./flows.js";

const MARK = "≈";

export const isApprox = (code: string) => code.startsWith(MARK);

export const plainCode = (code: string) =>
  isApprox(code) ? code.slice(MARK.length) : code;

export function displayCode(codes: Iterable<string>): string | null {
  if (!display.active) {
    return null;
  }
  for (const code of codes) {
    if (code !== display.code && display.rate(code) !== null) {
      return `${MARK}${display.code}`;
    }
  }
  return null;
}

export const shownCode = (code: string, into: string | null) =>
  into && display.rate(code) !== null ? into : code;

export function inDisplay(
  amount: number,
  code: string,
  into: string | null = displayCode([code])
): { amount: number; code: string } {
  const value = into ? display.convert(amount, code) : null;
  return into && value !== null
    ? { amount: value, code: into }
    : { amount, code };
}

export function displayFlows(
  flows: Flow[],
  into = displayCode(new Set(flows.map((flow) => flow.currency)))
): Flow[] {
  if (!into) {
    return flows;
  }
  const rates = new Map<string, number | null>();
  const rateOf = (code: string) => {
    if (!rates.has(code)) {
      rates.set(code, display.rate(code));
    }
    return rates.get(code) ?? null;
  };
  return flows.map((flow) => {
    const rate = rateOf(flow.currency);
    return rate === null
      ? flow
      : { ...flow, amount: flow.amount * rate, currency: into };
  });
}
