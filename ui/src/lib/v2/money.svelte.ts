import { toNumber } from "#lib/format.js";
import { display } from "#lib/money/display.svelte.js";
import { session } from "#lib/session.svelte.js";

const PREFIX = new Set(["$", "€", "£", "¥", "₹"]);

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function num(value: number, decimals = 2): string {
  const text = (decimals === 0 ? whole : number).format(Math.abs(value));
  return text.replace(/,/g, " ").replace(".", ",");
}

export function symbolOf(code: string): string {
  const found = session.currencies.find((c) => c.attributes.code === code);
  return found?.attributes.symbol ?? code;
}

export function money(
  value: number,
  code: string,
  { signed = false, decimals = 2 }: { signed?: boolean; decimals?: number } = {}
): string {
  let sign = "";
  if (value < 0) {
    sign = "−";
  } else if (signed && value > 0) {
    sign = "+";
  }
  const symbol = symbolOf(code);
  const body = num(value, decimals);
  return PREFIX.has(symbol)
    ? `${sign}${symbol}${body}`
    : `${sign}${body} ${symbol}`;
}

export const primaryCode = () => session.primary?.code ?? "";

const ORIGINAL = "ffui.original";

class View {
  original = $state(typeof localStorage !== "undefined" && localStorage.getItem(ORIGINAL) === "1");

  get code(): string {
    return display.code || primaryCode();
  }

  get ready(): boolean {
    return this.code === primaryCode() || display.graph !== null;
  }

  boot() {
    if (!display.on) {
      display.show(display.code || primaryCode());
    }
    return display.load();
  }

  choose(code: string) {
    display.show(code);
    this.keep(false);
  }

  chooseOriginal() {
    this.keep(true);
  }

  private keep(original: boolean) {
    this.original = original;
    localStorage.setItem(ORIGINAL, original ? "1" : "0");
  }

  foreign(code: string | null | undefined): boolean {
    return !this.original && !!code && code !== this.code;
  }

  each(value: number, amount: number, code: string | null | undefined, opts?: { signed?: boolean; decimals?: number }): string {
    return this.original && code ? money(amount, code, opts) : this.show(value, opts);
  }

  conv(amount: number | string | null | undefined, from: string | null | undefined): number | null {
    const value = toNumber(amount);
    if (!from || from === this.code) {
      return value;
    }
    const rate = display.rate(from);
    return rate === null ? null : value * rate;
  }

  fromPrimary(amount: number | string | null | undefined): number {
    return this.conv(amount, primaryCode()) ?? toNumber(amount);
  }

  show(value: number, opts?: { signed?: boolean; decimals?: number }): string {
    return money(value, this.code, opts);
  }
}

export const view = new View();
