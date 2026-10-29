import type { Split } from "#lib/api/types.js";
import { evalAmount, parseDate } from "#lib/components/inputs/parse.js";
import { today } from "#lib/dates.js";
import { session } from "#lib/session.svelte.js";
import type { Catalog } from "./catalog.svelte.js";
import {
  type AccountRef,
  type Cur,
  emptyForm,
  KINDS,
  OWN_SIDE,
  type Side,
  type SplitForm,
  type TxType,
  TYPE_LABEL,
  toAccountRef,
} from "./model.js";

export type Marker = "@" | "^" | ">" | "!" | "$" | "%" | "#" | "~";

const MULTI = new Set<string>(["@", "^", ">", "!", "$", "%"]);
const MARKERS = new Set<string>([...MULTI, "#", "~"]);
const WORD = /\S+/g;
const NUMERIC = /^[\d(]/;

export interface Segment {
  end: number;
  marker: Marker;
  start: number;
  value: string;
}

export interface Equal {
  code: string;
  text: string;
}

export interface Quick {
  amount: number | null;
  amountText: string;
  currency: string;
  description: string;
  equal: Equal | null;
  segments: Segment[];
  type: TxType;
}

const enabledCodes = () =>
  new Set(
    session.currencies
      .filter((item) => item.attributes.enabled)
      .map((item) => item.attributes.code)
  );

interface Parse {
  amount: number | null;
  amountText: string;
  coded: "amount" | "equal" | null;
  currency: string;
  current: Segment | null;
  equal: Equal | null;
  segments: Segment[];
  words: string[];
}

function takeCode(state: Parse, word: string, codes: Set<string>) {
  const { coded } = state;
  const code = word.toUpperCase();
  state.coded = null;
  if (!(coded && codes.has(code))) {
    return false;
  }
  if (coded === "amount") {
    state.currency = code;
  } else if (state.equal) {
    state.equal.code = code;
  }
  return true;
}

function takeEqual(state: Parse, word: string) {
  if (!word.startsWith("=") || state.equal) {
    return false;
  }
  state.equal = { code: "", text: word.slice(1) };
  state.coded = "equal";
  state.current = null;
  return true;
}

function takeMarker(state: Parse, word: string, start: number) {
  const { current } = state;
  if (MARKERS.has(word[0])) {
    const segment = {
      end: start + word.length,
      marker: word[0] as Marker,
      start,
      value: word.slice(1),
    };
    state.segments.push(segment);
    state.current = MULTI.has(segment.marker) ? segment : null;
    return true;
  }
  if (current) {
    current.value = `${current.value} ${word}`;
    current.end = start + word.length;
    return true;
  }
  return false;
}

function takeAmount(state: Parse, word: string) {
  const value =
    state.amount === null && NUMERIC.test(word) ? evalAmount(word) : null;
  if (value === null) {
    return false;
  }
  state.amount = value;
  state.amountText = word;
  state.coded = "amount";
  return true;
}

export function parseQuick(input: string, codes = enabledCodes()): Quick {
  const state: Parse = {
    amount: null,
    amountText: "",
    coded: null,
    currency: "",
    current: null,
    equal: null,
    segments: [],
    words: [],
  };
  let deposit = false;
  let first = true;
  for (const match of input.matchAll(WORD)) {
    let [word] = match;
    let start = match.index;
    if (first && word.startsWith("+")) {
      deposit = true;
      word = word.slice(1);
      start += 1;
    }
    first = false;
    const taken =
      !word ||
      takeCode(state, word, codes) ||
      takeEqual(state, word) ||
      takeMarker(state, word, start) ||
      takeAmount(state, word);
    if (!taken) {
      state.words.push(word);
    }
  }
  const hasTarget = state.segments.some((segment) => segment.marker === ">");
  let type: TxType = "withdrawal";
  if (hasTarget) {
    type = "transfer";
  } else if (deposit) {
    type = "deposit";
  }
  return {
    amount: state.amount,
    amountText: state.amountText,
    currency: state.currency,
    description: state.words.join(" "),
    equal: state.equal,
    segments: state.segments,
    type,
  };
}

export const markerValue = (quick: Quick, marker: Marker) =>
  quick.segments
    .filter((segment) => segment.marker === marker)
    .at(-1)
    ?.value.trim() ?? "";

export const tagsOf = (quick: Quick) =>
  quick.segments
    .filter((segment) => segment.marker === "#" && segment.value)
    .map((segment) => segment.value);

export function segmentAt(
  quick: Quick,
  input: string,
  caret: number
): Segment | null {
  const last = quick.segments.at(-1);
  for (const segment of quick.segments) {
    const open =
      segment === last && MULTI.has(segment.marker) && caret === input.length;
    if (caret > segment.start && (caret <= segment.end || open)) {
      return segment;
    }
  }
  return null;
}

export function complete(
  input: string,
  segment: Segment,
  label: string
): { caret: number; text: string } {
  const before = input.slice(0, segment.start + 1) + label;
  const rest = input.slice(segment.end).trimStart();
  return { caret: before.length + 1, text: `${before} ${rest}` };
}

export const sidesOf = (type: TxType): { other: Side; own: Side } => {
  const own = OWN_SIDE[type];
  return { other: own === "source" ? "destination" : "source", own };
};

export const counterpartyKinds = (type: TxType) =>
  type === "transfer"
    ? KINDS.transfer.destination
    : KINDS[type][sidesOf(type).other];

function resolveAccounts(quick: Quick, catalog: Catalog, split: SplitForm) {
  const { own, other } = sidesOf(quick.type);
  const ownName = markerValue(quick, "^");
  const ownAccount = ownName
    ? catalog.findAccount(KINDS[quick.type][own], ownName)
    : catalog.defaultAccount();
  if (ownAccount) {
    split[own] = toAccountRef(ownAccount);
  }
  const otherName = markerValue(quick, quick.type === "transfer" ? ">" : "@");
  const otherAccount = otherName
    ? catalog.findAccount(counterpartyKinds(quick.type), otherName)
    : undefined;
  split[other] = otherAccount
    ? toAccountRef(otherAccount)
    : { ...split[other], name: otherName };
  return ownAccount || !ownName
    ? []
    : [`No asset account or liability called "${ownName}"`];
}

function curOf(code: string | undefined): Cur | null {
  const found = session.currencies.find(
    (item) => item.attributes.code === code
  );
  return found
    ? {
        code: found.attributes.code,
        decimals: found.attributes.decimal_places ?? 2,
        symbol: found.attributes.symbol,
      }
    : null;
}

function resolveMoney(
  quick: Quick,
  split: SplitForm,
  own: AccountRef,
  target: AccountRef | null
): string[] {
  const native = own.currency?.code;
  const { equal } = quick;
  split.currency = own.currency;
  split.amount = quick.amountText;
  const first = quick.currency || native;
  if (!native) {
    return [];
  }
  if (!equal) {
    return first === native
      ? []
      : [`${own.name} is in ${native}: add =amount ${native}`];
  }
  const second =
    equal.code || (first === native ? target?.currency?.code : native);
  if (first === native && second && second !== native) {
    split.foreignAmount = equal.text;
    split.foreignCurrency = curOf(second);
    return [];
  }
  if (second === native && first !== native) {
    split.amount = equal.text;
    split.foreignAmount = quick.amountText;
    split.foreignCurrency = curOf(first);
    return [];
  }
  const example =
    session.currencies.find(
      (item) => item.attributes.enabled && item.attributes.code !== native
    )?.attributes.code ?? "USD";
  return [`Name the other currency, like =${equal.text || "520"} ${example}`];
}

function resolveBill(quick: Quick, catalog: Catalog, split: SplitForm) {
  const name = markerValue(quick, "%");
  if (!name) {
    return [];
  }
  if (quick.type !== "withdrawal") {
    return ["Only a withdrawal can pay a subscription"];
  }
  const wanted = name.toLowerCase();
  const bill = (catalog.bills.data ?? []).find(
    (item) => item.attributes.name?.toLowerCase() === wanted
  );
  if (!bill) {
    return [`No subscription called "${name}"`];
  }
  split.bill = { id: bill.id, name: bill.attributes.name ?? name };
  return [];
}

function resolveLinks(
  quick: Quick,
  catalog: Catalog,
  split: SplitForm,
  past: Split | null | undefined
) {
  const categoryName = markerValue(quick, "!");
  const budgetName = markerValue(quick, "$");
  const learn = quick.type !== "transfer" && past;
  split.category = categoryName || (learn ? (past.category_name ?? "") : "");
  const budget = budgetName ? catalog.findBudget(budgetName) : undefined;
  if (budget) {
    split.budget = { id: budget.id, name: budget.attributes.name };
  } else if (!budgetName && learn && past.budget_id) {
    split.budget = { id: past.budget_id, name: past.budget_name ?? "" };
  }
  return {
    fromPast: {
      budget: !budgetName && Boolean(split.budget.id),
      category: !categoryName && Boolean(split.category),
    },
    problems: budgetName && !budget ? [`No budget called "${budgetName}"`] : [],
  };
}

export function resolveQuick(
  quick: Quick,
  catalog: Catalog,
  recent: Record<string, Split | null>
) {
  const form = emptyForm(quick.type);
  const [split] = form.splits;
  const { own, other } = sidesOf(quick.type);
  const problems = resolveAccounts(quick, catalog, split);
  const counterparty = split[other].id;
  const links = resolveLinks(
    quick,
    catalog,
    split,
    counterparty ? recent[counterparty] : null
  );
  problems.push(
    ...links.problems,
    ...resolveBill(quick, catalog, split),
    ...resolveMoney(
      quick,
      split,
      split[own],
      quick.type === "transfer" ? split[other] : null
    )
  );
  split.tags = tagsOf(quick);
  split.description =
    quick.description ||
    split[other].name ||
    split.category ||
    TYPE_LABEL[quick.type];
  const dateText = markerValue(quick, "~");
  const date = dateText ? parseDate(dateText) : today();
  if (date) {
    form.date = date;
  } else {
    problems.push(`"${dateText}" is not a date`);
  }
  return { form, fromPast: links.fromPast, problems };
}
