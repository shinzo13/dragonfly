import type { Item, Split, TransactionGroup } from "#lib/api/types.js";
import { toNumber } from "#lib/format.js";

export type Kind = "out" | "in" | "move";

export const BLOCKADE_TAG = "blockade";

export interface Row {
  id: string;
  date: string;
  title: string;
  raw: string;
  kind: Kind;
  type: string;
  amount: number;
  code: string;
  pc: number;
  categoryId: string | null;
  category: string | null;
  budgetId: string | null;
  tags: string[];
  account: string;
  accountId: string;
  other: string;
  otherId: string;
  splits: Split[];
  notes: string;
}

const DATE_IN_TITLE = /\s*\d{4}-\d{2}-\d{2}\s*/g;
const CODE_TAIL = /(\s+[A-Za-z.]*\d[\w.\-/]*)+$/;
const LEGAL_TAIL = /\s+(SP\.? ?Z ?O\.? ?O\.?|SPÓŁKA Z OGR.*|LIMITED.*|S\.A\.?|SA\b.*)$/i;
const SPLIT_PREFIX = /^([^:]+):\s*/;
const UPPER_WORD = /\p{Lu}[\p{Lu}\d'’-]+/gu;

export function prettify(text: string): string {
  let out = text.replace(DATE_IN_TITLE, " ").trim();
  out = out.replace(LEGAL_TAIL, "").replace(CODE_TAIL, "").trim() || out;
  return out.replace(UPPER_WORD, (word) =>
    word.length > 3 ? word[0] + word.slice(1).toLowerCase() : word
  );
}

function kindOf(type: string): Kind {
  if (type === "withdrawal") {
    return "out";
  }
  if (type === "deposit") {
    return "in";
  }
  return "move";
}

export function toRow({ id, attributes }: Item<TransactionGroup>): Row {
  const splits = attributes.transactions;
  const first = splits[0];
  const kind = kindOf(first.type);
  const amount = splits.reduce((s, x) => s + toNumber(x.amount), 0);
  const pc = splits.reduce((s, x) => s + toNumber(x.pc_amount ?? x.amount), 0);
  const tags = [...new Set(splits.flatMap((x) => x.tags ?? []))];
  const mine = kind === "in";
  const sharedPrefix = first.description.match(SPLIT_PREFIX)?.[1];
  const base =
    attributes.group_title ||
    (splits.length > 1 && sharedPrefix ? sharedPrefix : first.description);
  return {
    account: (mine ? first.destination_name : first.source_name) ?? "",
    accountId: (mine ? first.destination_id : first.source_id) ?? "",
    amount,
    budgetId: first.budget_id ?? null,
    category: first.category_name ?? null,
    categoryId: first.category_id ?? null,
    code: first.currency_code ?? "",
    date: first.date.slice(0, 10),
    id,
    kind,
    notes: splits.map((x) => x.notes ?? "").filter(Boolean).join("\n"),
    other: (mine ? first.source_name : first.destination_name) ?? "",
    otherId: (mine ? first.source_id : first.destination_id) ?? "",
    pc,
    raw: first.description,
    splits,
    tags,
    title: prettify(base),
    type: first.type,
  };
}

export const isBlockade = (row: Row) => row.tags.includes(BLOCKADE_TAG);

export function byDay(rows: Row[]): [string, Row[]][] {
  const days = new Map<string, Row[]>();
  for (const row of rows) {
    const list = days.get(row.date);
    if (list) {
      list.push(row);
    } else {
      days.set(row.date, [row]);
    }
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export const signed = (row: Row, value: number) => {
  if (row.kind === "out") {
    return -Math.abs(value);
  }
  if (row.kind === "in") {
    return Math.abs(value);
  }
  return 0;
};

export function splitTitle(split: Split): string {
  return split.description.replace(SPLIT_PREFIX, "") || split.description;
}
