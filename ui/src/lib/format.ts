export interface Money {
  amount: string | number | null | undefined;
  code?: string | null;
  decimals?: number | null;
  symbol?: string | null;
}

const settings: { anonymous: boolean; locale: string } = {
  anonymous: false,
  locale: "en-GB",
};

export function configureFormat(locale: string, anonymous: boolean) {
  settings.locale = locale;
  settings.anonymous = anonymous;
}

export const currentLocale = () => settings.locale;

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(decimals: number, signed: boolean): Intl.NumberFormat {
  const key = `${settings.locale}|${decimals}|${signed}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(settings.locale, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
      signDisplay: signed ? "exceptZero" : "auto",
    });
    numberFormats.set(key, format);
  }
  return format;
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return typeof value === "number" ? value : Number.parseFloat(value);
}

export function formatNumber(
  value: string | number | null | undefined,
  decimals = 2,
  signed = false
): string {
  if (settings.anonymous) {
    return numberFormat(decimals, false).format(0);
  }
  return numberFormat(decimals, signed).format(toNumber(value));
}

function signOf(value: number, signed: boolean): string {
  if (settings.anonymous || value === 0) {
    return "";
  }
  if (value < 0) {
    return "-";
  }
  return signed ? "+" : "";
}

export function formatMoney(money: Money, signed = false): string {
  const value = toNumber(money.amount);
  const number = formatNumber(Math.abs(value), money.decimals ?? 2);
  const symbol = money.symbol ?? money.code ?? "";
  return `${signOf(value, signed)}${symbol}${number}`;
}

export function compactMoney(value: number, symbol = ""): string {
  if (settings.anonymous) {
    return `${symbol}0`;
  }
  const format = new Intl.NumberFormat(settings.locale, {
    maximumFractionDigits: 1,
    notation: "compact",
  });
  return `${symbol}${format.format(value)}`;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${settings.locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(settings.locale, options);
    dateFormats.set(key, format);
  }
  return format;
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(
  value: string | Date | null | undefined,
  style: "short" | "medium" | "long" | "day" | "month" | "year" = "medium"
): string {
  if (!value) {
    return "";
  }
  const date = toDate(value);
  switch (style) {
    case "short":
      return dateFormat({ day: "2-digit", month: "short" }).format(date);
    case "day":
      return dateFormat({
        day: "numeric",
        month: "short",
        weekday: "short",
      }).format(date);
    case "month":
      return dateFormat({ month: "long", year: "numeric" }).format(date);
    case "year":
      return dateFormat({ year: "numeric" }).format(date);
    case "long":
      return dateFormat({ dateStyle: "long" }).format(date);
    default:
      return dateFormat({ dateStyle: "medium" }).format(date);
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return dateFormat({ dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

export function formatRange(start: string, end: string): string {
  return dateFormat({ dateStyle: "medium" }).formatRange(
    toDate(start),
    toDate(end)
  );
}

export function percent(value: number, digits = 0): string {
  return new Intl.NumberFormat(settings.locale, {
    maximumFractionDigits: digits,
    style: "percent",
  }).format(value);
}
