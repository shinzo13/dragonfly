import { addDays, iso, today } from "#lib/dates.js";

const SPACES = /\s+/g;
const NUMBER = /^\d[\d.,]*/;
const OPERATOR = /[+\-*/()]/;
const ISO_DAY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DOTTED = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/;
const RELATIVE = /^[+-]\d{1,4}$/;
const EXPRESSION = /\d\s*[+\-*/]\s*[\d(]/;

function toDecimal(raw: string): number | null {
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  let text = raw;
  if (comma !== -1 && dot !== -1) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    text = raw.split(thousands).join("").replace(decimal, ".");
  } else if (comma !== -1) {
    const parts = raw.split(",");
    const fraction = parts.at(-1) ?? "";
    text =
      parts.length === 2 && fraction.length <= 2
        ? parts.join(".")
        : parts.join("");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function tokenize(input: string): (number | string)[] | null {
  const tokens: (number | string)[] = [];
  let rest = input;
  while (rest) {
    const number = rest.match(NUMBER);
    if (number) {
      const value = toDecimal(number[0]);
      if (value === null) {
        return null;
      }
      tokens.push(value);
      rest = rest.slice(number[0].length);
    } else if (OPERATOR.test(rest[0])) {
      tokens.push(rest[0]);
      rest = rest.slice(1);
    } else {
      return null;
    }
  }
  return tokens;
}

function evaluate(tokens: (number | string)[]): number | null {
  let index = 0;
  const peek = () => tokens[index];
  const next = () => {
    index += 1;
    return tokens[index - 1];
  };
  const factor = (): number | null => {
    const token = next();
    if (token === "-") {
      const value = factor();
      return value === null ? null : -value;
    }
    if (token === "(") {
      const value = sum();
      return next() === ")" ? value : null;
    }
    return typeof token === "number" ? token : null;
  };
  const product = (): number | null => {
    let left = factor();
    while (left !== null && (peek() === "*" || peek() === "/")) {
      const op = next();
      const right = factor();
      if (right === null) {
        return null;
      }
      left = op === "*" ? left * right : left / right;
    }
    return left;
  };
  const sum = (): number | null => {
    let left = product();
    while (left !== null && (peek() === "+" || peek() === "-")) {
      const op = next();
      const right = product();
      if (right === null) {
        return null;
      }
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };
  const value = sum();
  return index === tokens.length && value !== null && Number.isFinite(value)
    ? value
    : null;
}

export function evalAmount(input: string): number | null {
  const text = input.replace(SPACES, "");
  if (!text) {
    return null;
  }
  const tokens = tokenize(text);
  return tokens ? evaluate(tokens) : null;
}

export const isExpression = (input: string) =>
  EXPRESSION.test(input) || input.includes("(");

export function amountString(input: string, decimals = 2): string {
  const value = evalAmount(input);
  return value === null ? "" : value.toFixed(decimals);
}

function valid(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day
    ? iso(date)
    : null;
}

const WORDS: Record<string, number> = {
  tod: 0,
  today: 0,
  tom: 1,
  tomorrow: 1,
  yd: -1,
  yest: -1,
  yesterday: -1,
};

export function parseDate(input: string, base = today()): string | null {
  const text = input.trim().toLowerCase();
  if (!text) {
    return null;
  }
  if (text in WORDS) {
    return addDays(base, WORDS[text]);
  }
  if (RELATIVE.test(text)) {
    return addDays(base, Number(text));
  }
  const full = text.match(ISO_DAY);
  if (full) {
    return valid(Number(full[1]), Number(full[2]), Number(full[3]));
  }
  const dotted = text.match(DOTTED);
  if (dotted) {
    const year = Number(base.slice(0, 4));
    const raw = dotted[3] ? Number(dotted[3]) : year;
    return valid(
      raw < 100 ? 2000 + raw : raw,
      Number(dotted[2]),
      Number(dotted[1])
    );
  }
  return null;
}
