import type { Split } from "#lib/api/types.js";
import { addDays, addMonths, type Range } from "#lib/dates.js";
import { formatDate } from "#lib/format.js";
import { display } from "#lib/money/display.svelte.js";
import {
  accountUrl,
  type Group,
  type Signed,
  signedAmount,
  TYPE_LABEL,
} from "./split.js";

export type FacetId =
  | "kind"
  | "category"
  | "budget"
  | "account"
  | "currency"
  | "tag"
  | "bill"
  | "notes"
  | "foreign";
export type GroupBy = "day" | "destination" | "category" | "budget";

export interface Facet {
  id: FacetId;
  keys: (split: Split) => string[];
  label: string;
  names?: Record<string, string>;
  none?: string;
}

export interface Count {
  count: number;
  key: string;
  label: string;
}

export interface Filters {
  dupes: boolean;
  facets: Partial<Record<FacetId, string[]>>;
  group: GroupBy | null;
  text: string;
}

export interface Section {
  actions?: {
    confirm?: boolean;
    label: string;
    run: () => void | Promise<void>;
  }[];
  href?: string;
  key: string;
  label: string;
}

export interface Cluster {
  groups: Group[];
  id: string;
  label: string;
}

export const NONE = "none";
export const GROUP_BY: GroupBy[] = ["day", "destination", "category", "budget"];
export const GROUP_LABEL: Record<GroupBy, string> = {
  budget: "Budget",
  category: "Category",
  day: "Day",
  destination: "Destination",
};

const OWN = new Set([
  "Asset account",
  "Default account",
  "Debt",
  "Loan",
  "Mortgage",
]);
const TONES = ["expense", "income", "transfer", "neutral"];
const WINDOW_MS = 48 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;
const WHITESPACE = /\s+/;
const COMPARE = /^([<>])(\d+(?:[.,]\d+)?)$/;
const NEEDS_QUOTES = /[\s"]/;
const QUOTE = /"/g;
const PARENS = /\(([^)]*)\)/g;
const YES_NO = (yes: string, no: string) => ({ no, yes });
const flag = (on: boolean) => [on ? "yes" : "no"];
const named = (name: string | null | undefined, applies: boolean) => {
  if (name) {
    return [name];
  }
  return applies ? [NONE] : [];
};

export const FACETS: Facet[] = [
  {
    id: "kind",
    keys: (s) => [s.type],
    label: "Type",
    names: TYPE_LABEL,
  },
  {
    id: "category",
    keys: (s) => named(s.category_name, true),
    label: "Category",
    none: "(no category)",
  },
  {
    id: "budget",
    keys: (s) => named(s.budget_name, s.type === "withdrawal"),
    label: "Budget",
    none: "(no budget)",
  },
  {
    id: "account",
    keys: (s) =>
      [
        OWN.has(s.source_type ?? "") ? s.source_name : null,
        OWN.has(s.destination_type ?? "") ? s.destination_name : null,
      ].filter((name): name is string => Boolean(name)),
    label: "Account",
  },
  {
    id: "currency",
    keys: (s) =>
      [s.currency_code, s.foreign_currency_code].filter(
        (code): code is string => Boolean(code)
      ),
    label: "Currency",
  },
  {
    id: "tag",
    keys: (s) => (s.tags?.length ? s.tags : [NONE]),
    label: "Tag",
    none: "(no tags)",
  },
  {
    id: "bill",
    keys: (s) =>
      named(s.bill_name ?? s.subscription_name, s.type === "withdrawal"),
    label: "Subscription",
    none: "(no subscription)",
  },
  {
    id: "notes",
    keys: (s) => flag(Boolean(s.notes?.trim())),
    label: "Notes",
    names: YES_NO("With notes", "Without notes"),
  },
  {
    id: "foreign",
    keys: (s) => flag(Boolean(s.foreign_amount && s.foreign_currency_code)),
    label: "Foreign",
    names: YES_NO("With foreign amount", "Without foreign amount"),
  },
];

const FACET = Object.fromEntries(FACETS.map((f) => [f.id, f])) as Record<
  FacetId,
  Facet
>;
const PARAMS = ["q", "group", "dupes", "page", ...FACETS.map((f) => f.id)];

export function valueLabel(id: FacetId, key: string): string {
  const facet = FACET[id];
  if (key === NONE && facet.none) {
    return facet.none;
  }
  return facet.names?.[key] ?? key;
}

export function readFilters(
  params: Pick<URLSearchParams, "get" | "getAll">
): Filters {
  const facets: Filters["facets"] = {};
  for (const facet of FACETS) {
    const values = params.getAll(facet.id).filter(Boolean);
    if (values.length > 0) {
      facets[facet.id] = [...new Set(values)];
    }
  }
  const group = params.get("group") as GroupBy;
  return {
    dupes: params.get("dupes") === "1",
    facets,
    group: GROUP_BY.includes(group) ? group : null,
    text: params.get("q") ?? "",
  };
}

export function filterParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  for (const facet of FACETS) {
    for (const value of [...(filters.facets[facet.id] ?? [])].sort()) {
      params.append(facet.id, value);
    }
  }
  if (filters.text.trim()) {
    params.set("q", filters.text);
  }
  if (filters.group) {
    params.set("group", filters.group);
  }
  if (filters.dupes) {
    params.set("dupes", "1");
  }
  return params;
}

export function withFilters(url: { href: string }, filters: Filters): URL {
  const next = new URL(url.href);
  for (const name of PARAMS) {
    next.searchParams.delete(name);
  }
  for (const [name, value] of filterParams(filters)) {
    next.searchParams.append(name, value);
  }
  return next;
}

export function isFiltered(filters: Filters): boolean {
  return (
    filters.dupes ||
    filters.text.trim() !== "" ||
    Object.values(filters.facets).some((values) => values.length > 0)
  );
}

export function toggleValue(
  filters: Filters,
  id: FacetId,
  key: string,
  on?: boolean
): Filters {
  const current = new Set(filters.facets[id] ?? []);
  if (on ?? !current.has(key)) {
    current.add(key);
  } else {
    current.delete(key);
  }
  return { ...filters, facets: { ...filters.facets, [id]: [...current] } };
}

const haystacks = new WeakMap<Split, string>();

function plainAmount(
  value: string | null | undefined,
  decimals?: number | null
) {
  return value ? Number(value).toFixed(decimals ?? 2) : "";
}

function haystack(split: Split): string {
  let text = haystacks.get(split);
  if (text === undefined) {
    text = [
      split.description,
      split.notes,
      split.source_name,
      split.destination_name,
      split.category_name,
      split.budget_name,
      split.bill_name,
      split.currency_code,
      split.foreign_currency_code,
      plainAmount(split.amount, split.currency_decimal_places),
      plainAmount(split.foreign_amount, split.foreign_currency_decimal_places),
      ...(split.tags ?? []),
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    haystacks.set(split, text);
  }
  return text;
}

function wordTest(word: string): (split: Split) => boolean {
  const match = COMPARE.exec(word);
  if (!match) {
    return (split) => haystack(split).includes(word);
  }
  const limit = Number(match[2].replace(",", "."));
  const size = (split: Split) => Math.abs(Number(split.amount));
  return match[1] === ">"
    ? (split) => size(split) > limit
    : (split) => size(split) < limit;
}

export function splitTest(
  filters: Filters,
  skip?: FacetId
): (split: Split) => boolean {
  const words = filters.text
    .toLowerCase()
    .split(WHITESPACE)
    .filter((word) => word && !word.includes(":"))
    .map(wordTest);
  const active = FACETS.filter(
    (facet) => facet.id !== skip && filters.facets[facet.id]?.length
  ).map((facet) => ({ facet, wanted: new Set(filters.facets[facet.id]) }));
  return (split) =>
    active.every(({ facet, wanted }) =>
      facet.keys(split).some((key) => wanted.has(key))
    ) && words.every((test) => test(split));
}

export function narrow(
  groups: Group[],
  test: (split: Split) => boolean,
  keep: (group: Group) => boolean = () => true
): Group[] {
  const out: Group[] = [];
  for (const group of groups) {
    if (!keep(group)) {
      continue;
    }
    const splits = group.attributes.transactions;
    const kept = splits.filter(test);
    if (kept.length === splits.length) {
      out.push(group);
    } else if (kept.length > 0) {
      out.push({
        ...group,
        attributes: { ...group.attributes, transactions: kept },
      });
    }
  }
  return out;
}

export function countFacets(
  groups: Group[],
  filters: Filters,
  ids: FacetId[],
  keep: (group: Group) => boolean
): Map<FacetId, Count[]> {
  const result = new Map<FacetId, Count[]>();
  for (const id of ids) {
    const facet = FACET[id];
    const test = splitTest(filters, id);
    const found = new Map<string, Set<string>>(
      (filters.facets[id] ?? []).map((key) => [key, new Set()])
    );
    for (const group of groups) {
      if (!keep(group)) {
        continue;
      }
      for (const split of group.attributes.transactions) {
        if (!test(split)) {
          continue;
        }
        for (const key of facet.keys(split)) {
          const seen = found.get(key) ?? new Set<string>();
          seen.add(group.id);
          found.set(key, seen);
        }
      }
    }
    const counts = [...found].map(([key, seen]) => ({
      count: seen.size,
      key,
      label: valueLabel(id, key),
    }));
    counts.sort(
      (a, b) =>
        Number(b.key === NONE) - Number(a.key === NONE) ||
        b.count - a.count ||
        a.label.localeCompare(b.label)
    );
    result.set(id, counts);
  }
  return result;
}

export function sectionOf(by: GroupBy, group: Group): Section {
  const [split] = group.attributes.transactions;
  switch (by) {
    case "day": {
      const day = split?.date?.slice(0, 10) ?? "";
      return { key: day, label: formatDate(day, "day") };
    }
    case "destination":
      return {
        href: accountUrl(split?.destination_id),
        key: `account:${split?.destination_id ?? ""}`,
        label: split?.destination_name ?? "(cash)",
      };
    case "category":
      return {
        href: split?.category_id
          ? `/categories/show/${split.category_id}`
          : undefined,
        key: split?.category_name ?? NONE,
        label: split?.category_name ?? "(no category)",
      };
    default:
      return {
        href: split?.budget_id ? `/budgets/show/${split.budget_id}` : undefined,
        key: split?.budget_name ?? NONE,
        label: split?.budget_name ?? "(no budget)",
      };
  }
}

export function bySection(
  groups: Group[],
  section: (group: Group) => Section
): Group[] {
  const buckets = new Map<string, Group[]>();
  for (const group of groups) {
    const { key } = section(group);
    const list = buckets.get(key) ?? [];
    list.push(group);
    buckets.set(key, list);
  }
  return [...buckets]
    .sort(
      ([a, left], [b, right]) =>
        Number(b === NONE) - Number(a === NONE) || right.length - left.length
    )
    .flatMap(([, list]) => list);
}

export function subtotals(groups: Group[], accountId?: string): Signed[] {
  const sums = new Map<string, Signed>();
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      const money = signedAmount(split, accountId);
      const key = `${money.tone}|${money.code}`;
      const sum = sums.get(key);
      if (sum) {
        sum.amount += money.amount;
      } else {
        sums.set(key, { ...money });
      }
    }
  }
  return [...sums.values()].sort(
    (a, b) =>
      TONES.indexOf(a.tone) - TONES.indexOf(b.tone) ||
      (a.code ?? "").localeCompare(b.code ?? "")
  );
}

function newestFirst(a: Group, b: Group) {
  const dateA = a.attributes.transactions[0]?.date ?? "";
  const dateB = b.attributes.transactions[0]?.date ?? "";
  return dateB.localeCompare(dateA) || Number(b.id) - Number(a.id);
}

function spanLabel(ms: number): string {
  const hours = Math.max(1, Math.round(ms / HOUR_MS));
  if (hours < 24) {
    return `${hours} h`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

function clusterOf(
  run: { group: Group; time: number }[],
  split: Split
): Cluster {
  const groups = [...new Set(run.map((item) => item.group))].sort(newestFirst);
  const span = (run.at(-1)?.time ?? 0) - (run[0]?.time ?? 0);
  const money = display.text([
    {
      amount: split.amount,
      code: split.currency_code,
      decimals: split.currency_decimal_places,
      symbol: split.currency_symbol,
    },
  ]);
  return {
    groups,
    id: groups
      .map((group) => group.id)
      .sort()
      .join("+"),
    label: `${split.destination_name ?? "(cash)"} · ${money} · ${spanLabel(span)} apart`,
  };
}

export function duplicates(
  groups: Group[],
  ignored: Set<string>
): Map<string, Cluster> {
  const buckets = new Map<
    string,
    { group: Group; split: Split; time: number }[]
  >();
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      if (!split.destination_id) {
        continue;
      }
      const key = `${split.type}|${split.destination_id}|${split.currency_code}|${Number(split.amount)}`;
      const list = buckets.get(key) ?? [];
      list.push({ group, split, time: Date.parse(split.date) });
      buckets.set(key, list);
    }
  }
  const found = new Map<string, Cluster>();
  const flush = (run: { group: Group; split: Split; time: number }[]) => {
    if (new Set(run.map((item) => item.group.id)).size < 2) {
      return;
    }
    const cluster = clusterOf(run, run[0].split);
    if (ignored.has(cluster.id)) {
      return;
    }
    for (const group of cluster.groups) {
      found.set(group.id, cluster);
    }
  };
  for (const list of buckets.values()) {
    list.sort((a, b) => a.time - b.time);
    let run: typeof list = [];
    for (const item of list) {
      const last = run.at(-1);
      if (last && item.time - last.time > WINDOW_MS) {
        flush(run);
        run = [];
      }
      run.push(item);
    }
    flush(run);
  }
  return found;
}

export function accountIdOf(groups: Group[], name: string): string | undefined {
  for (const group of groups) {
    for (const split of group.attributes.transactions) {
      if (split.source_name === name && OWN.has(split.source_type ?? "")) {
        return split.source_id ?? undefined;
      }
      if (
        split.destination_name === name &&
        OWN.has(split.destination_type ?? "")
      ) {
        return split.destination_id ?? undefined;
      }
    }
  }
}

export function yearRange(end: string): Range {
  return { end, start: addDays(addMonths(end, -12), 1) };
}

const quote = (value: string) =>
  NEEDS_QUOTES.test(value) ? `"${value.replace(QUOTE, '\\"')}"` : value;

const OPERATOR: Partial<Record<FacetId, [string, string]>> = {
  account: ["account_is", ""],
  bill: ["bill_is", "has_no_bill:true"],
  budget: ["budget_is", "has_no_budget:true"],
  category: ["category_is", "has_no_category:true"],
  currency: ["currency_is", ""],
  kind: ["type", ""],
  tag: ["tag_is", "has_no_tag:true"],
};
const FLAG_OPERATOR: Record<string, Record<string, string>> = {
  foreign: { no: "-has_foreign_amount:true", yes: "has_foreign_amount:true" },
  notes: { no: "no_notes:true", yes: "has_any_notes:true" },
};

export function searchQuery(
  filters: Filters,
  type: string,
  range: Range | null
): string {
  const parts = [filters.text.trim()];
  if (type !== "all") {
    parts.push(`type:${type}`);
  }
  for (const [id, values] of Object.entries(filters.facets)) {
    if (values?.length !== 1) {
      continue;
    }
    const [value] = values;
    const flagged = FLAG_OPERATOR[id]?.[value];
    const [operator, none] = OPERATOR[id as FacetId] ?? ["", ""];
    if (flagged) {
      parts.push(flagged);
    } else if (value === NONE && none) {
      parts.push(none);
    } else if (operator) {
      parts.push(`${operator}:${quote(value)}`);
    }
  }
  if (range) {
    parts.push(`date_after:${range.start}`, `date_before:${range.end}`);
  }
  return parts.filter(Boolean).join(" ");
}

export function describe(filters: Filters): string {
  const parts: string[] = [];
  for (const facet of FACETS) {
    const values = filters.facets[facet.id] ?? [];
    if (values.length > 0) {
      parts.push(values.map((key) => valueLabel(facet.id, key)).join(" or "));
    }
  }
  if (filters.text.trim()) {
    parts.push(`“${filters.text.trim()}”`);
  }
  if (filters.dupes) {
    parts.push("Duplicates");
  }
  if (filters.group) {
    parts.push(`by ${GROUP_LABEL[filters.group].toLowerCase()}`);
  }
  const label = parts.join(", ").replace(PARENS, "$1");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
