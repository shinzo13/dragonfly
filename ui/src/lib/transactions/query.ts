import { api } from "#lib/api/client.js";

export interface Operator {
  alias: boolean;
  alias_for?: string;
  name: string;
}

export type ValueKind =
  | "account"
  | "amount"
  | "bill"
  | "bool"
  | "budget"
  | "category"
  | "currency"
  | "date"
  | "id"
  | "none"
  | "tag"
  | "text"
  | "type";

export interface Token {
  end: number;
  field: string | null;
  negated: boolean;
  start: number;
  value: string;
}

export interface Suggestion {
  hint?: string;
  id: string;
  insert: string;
  label: string;
}

const BOOL_NAMES = new Set([
  "reconciled",
  "exists",
  "source_is_cash",
  "destination_is_cash",
  "account_is_cash",
]);
const ACCOUNT_ALIASES = new Set(["source", "destination", "from", "to"]);
const BOOL_PREFIX = /^(has_|any_|no_)/;
const DATE_PART = /(^|_)(date|on|before|after|at)(_|$)/;
const AMOUNT_PART = /amount|balance|^less$|^more$/;
const ID_END = /(^|_)id$/;
const ACCOUNT_NAME = /(^|_)account_(is|contains|ends|starts)$/;
const NEEDS_QUOTES = /[\s"()]/;
const SEPARATOR = /[\s()]/;
const QUOTE = /"/g;
const TRAILING_QUOTE = /"$/;
const LEADING_SPACE = /^ /;

export const TYPES = [
  "withdrawal",
  "deposit",
  "transfer",
  "reconciliation",
  "opening balance",
];

export function kindOf(name: string): ValueKind {
  const checks: [boolean, ValueKind][] = [
    [name === "user_action", "none"],
    [BOOL_PREFIX.test(name) || BOOL_NAMES.has(name), "bool"],
    [name === "transaction_type" || name === "type", "type"],
    [DATE_PART.test(name), "date"],
    [AMOUNT_PART.test(name), "amount"],
    [ID_END.test(name) && !name.startsWith("external"), "id"],
    [name.includes("currency"), "currency"],
    [name.startsWith("category"), "category"],
    [name.startsWith("budget"), "budget"],
    [name.startsWith("tag"), "tag"],
    [name.startsWith("bill") || name.startsWith("subscription"), "bill"],
    [ACCOUNT_NAME.test(name) || ACCOUNT_ALIASES.has(name), "account"],
  ];
  return checks.find(([hit]) => hit)?.[1] ?? "text";
}

interface OperatorConfig {
  data: {
    value: Record<string, { alias: boolean; alias_for?: string }>;
  };
}

export const operatorsQuery = () => ({
  queryFn: async (): Promise<Operator[]> => {
    const config = await api<OperatorConfig>(
      "/v1/configuration/search.operators"
    );
    return Object.entries(config.data.value)
      .filter(([name]) => name !== "user_action")
      .map(([name, item]) => ({
        alias: item.alias,
        alias_for: item.alias_for,
        name,
      }));
  },
  queryKey: ["search-operators"],
  staleTime: Number.POSITIVE_INFINITY,
});

export function quote(value: string): string {
  return value === "" || NEEDS_QUOTES.test(value)
    ? `"${value.replace(QUOTE, '\\"')}"`
    : value;
}

function unquote(value: string): string {
  return value.startsWith('"')
    ? value.slice(1).replace(TRAILING_QUOTE, "").replaceAll('\\"', '"')
    : value;
}

export function tokenAt(text: string, caret: number): Token {
  let start = 0;
  let quoted = false;
  for (let i = 0; i < caret; i += 1) {
    const char = text[i];
    if (char === '"' && text[i - 1] !== "\\") {
      quoted = !quoted;
    } else if (!quoted && SEPARATOR.test(char)) {
      start = i + 1;
    }
  }
  let end = caret;
  while (end < text.length && (quoted || !SEPARATOR.test(text[end]))) {
    if (text[end] === '"' && text[end - 1] !== "\\") {
      quoted = !quoted;
    }
    end += 1;
  }
  const raw = text.slice(start, caret);
  const negated = raw.startsWith("-");
  const body = negated ? raw.slice(1) : raw;
  const colon = body.indexOf(":");
  return {
    end,
    field: colon < 0 ? null : body.slice(0, colon).toLowerCase(),
    negated,
    start,
    value: colon < 0 ? body : unquote(body.slice(colon + 1)),
  };
}

export function tokens(text: string): string[] {
  const list: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && text[i - 1] !== "\\") {
      quoted = !quoted;
    }
    if (!quoted && SEPARATOR.test(char)) {
      if (current) {
        list.push(current);
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current) {
    list.push(current);
  }
  return list;
}

function rank(operator: Operator, prefix: string): number {
  const position = operator.name.indexOf(prefix);
  if (position < 0) {
    return -1;
  }
  return (position === 0 ? 0 : 2) + (operator.alias ? 1 : 0);
}

export function operatorSuggestions(
  operators: Operator[],
  token: Token,
  limit = 8
): Suggestion[] {
  const prefix = token.value.toLowerCase();
  if (!prefix) {
    return [];
  }
  const sign = token.negated ? "-" : "";
  return operators
    .map((operator, index) => ({
      index,
      operator,
      score: rank(operator, prefix),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(({ operator }) => ({
      hint: operator.alias_for
        ? `same as ${operator.alias_for}`
        : hintFor(kindOf(operator.name)),
      id: `op:${operator.name}`,
      insert: `${sign}${operator.name}:`,
      label: `${sign}${operator.name}:`,
    }));
}

function hintFor(kind: ValueKind): string {
  const hints: Partial<Record<ValueKind, string>> = {
    account: "account name",
    amount: "amount",
    bill: "subscription",
    bool: "true or false",
    budget: "budget",
    category: "category",
    currency: "currency",
    date: "date",
    id: "ids, comma separated",
    tag: "tag",
    type: "transaction type",
  };
  return hints[kind] ?? "text";
}

export function valueSuggestions(
  token: Token,
  values: string[],
  hints: Record<string, string> = {},
  limit = 8
): Suggestion[] {
  const needle = token.value.toLowerCase();
  const sign = token.negated ? "-" : "";
  const starts: string[] = [];
  const contains: string[] = [];
  for (const value of new Set(values)) {
    const lower = value.toLowerCase();
    if (lower.startsWith(needle)) {
      starts.push(value);
    } else if (lower.includes(needle)) {
      contains.push(value);
    }
  }
  return [...starts, ...contains].slice(0, limit).map((value) => ({
    hint: hints[value],
    id: `value:${value}`,
    insert: `${sign}${token.field}:${quote(value)} `,
    label: value,
  }));
}

export function replaceToken(
  text: string,
  token: Token,
  insert: string
): { caret: number; text: string } {
  const after = text
    .slice(token.end)
    .replace(LEADING_SPACE, insert.endsWith(" ") ? "" : " ");
  const next = text.slice(0, token.start) + insert;
  return { caret: next.length, text: next + (after.trim() ? after : "") };
}

function humanize(name: string): string {
  return name.replaceAll("_", " ");
}

function describe(
  field: string,
  value: string,
  negated: boolean,
  known: Map<string, string>
): string {
  const root = known.get(field);
  if (known.size > 0 && !root) {
    return `ignored ${field}:${value}`;
  }
  const name = humanize(root ?? field);
  if (kindOf(root ?? field) === "bool") {
    return (value === "true") === negated ? `not ${name}` : name;
  }
  return `${negated ? "not " : ""}${name} "${value}"`;
}

export function explain(text: string, operators: Operator[]): string[] {
  const known = new Map(operators.map((o) => [o.name, o.alias_for ?? o.name]));
  const words: string[] = [];
  const excluded: string[] = [];
  const parts: string[] = [];
  for (const raw of tokens(text)) {
    const negated = raw.startsWith("-");
    const body = negated ? raw.slice(1) : raw;
    const colon = body.indexOf(":");
    if (colon < 0) {
      (negated ? excluded : words).push(unquote(body));
    } else {
      const field = body.slice(0, colon).toLowerCase();
      parts.push(
        describe(field, unquote(body.slice(colon + 1)), negated, known)
      );
    }
  }
  if (excluded.length > 0) {
    parts.unshift(`description without "${excluded.join(" ")}"`);
  }
  if (words.length > 0) {
    parts.unshift(`description contains "${words.join(" ")}"`);
  }
  return parts;
}
