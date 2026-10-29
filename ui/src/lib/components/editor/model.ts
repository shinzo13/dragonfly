import type { Account, Item, Split, TransactionGroup } from "#lib/api/types.js";
import { amountString, evalAmount } from "#lib/components/inputs/parse.js";
import { today } from "#lib/dates.js";

export type TxType = "withdrawal" | "deposit" | "transfer";
export const TX_TYPES: TxType[] = ["withdrawal", "deposit", "transfer"];
export const TYPE_LABEL: Record<TxType, string> = {
  deposit: "Deposit",
  transfer: "Transfer",
  withdrawal: "Withdrawal",
};

export interface Cur {
  code: string;
  decimals: number;
  symbol: string;
}

export interface Ref {
  id: string | null;
  name: string;
}

export interface AccountRef extends Ref {
  currency: Cur | null;
  kind: string;
}

export const META_DATES = [
  "interest_date",
  "book_date",
  "process_date",
  "due_date",
  "payment_date",
  "invoice_date",
] as const;
export type MetaDate = (typeof META_DATES)[number];
export const META_DATE_LABEL: Record<MetaDate, string> = {
  book_date: "Book date",
  due_date: "Due date",
  interest_date: "Interest date",
  invoice_date: "Invoice date",
  payment_date: "Payment date",
  process_date: "Processing date",
};

export interface SplitForm {
  amount: string;
  bill: Ref;
  budget: Ref;
  category: string;
  currency: Cur | null;
  dates: Record<MetaDate, string>;
  description: string;
  destination: AccountRef;
  externalUrl: string;
  foreignAmount: string;
  foreignCurrency: Cur | null;
  internalReference: string;
  journalId: string | null;
  key: number;
  notes: string;
  piggy: Ref;
  reconciled: boolean;
  source: AccountRef;
  tags: string[];
}

export interface Form {
  date: string;
  splits: SplitForm[];
  time: string;
  title: string;
  type: TxType;
}

export type Side = "source" | "destination";

const ASSET = "Asset account";
const EXPENSE = "Expense account";
const REVENUE = "Revenue account";
export const CASH = "Cash account";
const LIABILITIES = ["Debt", "Loan", "Mortgage"];

export const KINDS: Record<TxType, Record<Side, string[]>> = {
  deposit: {
    destination: [ASSET, ...LIABILITIES],
    source: [REVENUE, ...LIABILITIES],
  },
  transfer: {
    destination: [ASSET, ...LIABILITIES],
    source: [ASSET, ...LIABILITIES],
  },
  withdrawal: {
    destination: [EXPENSE, ...LIABILITIES],
    source: [ASSET, ...LIABILITIES],
  },
};

export const FREE_KIND: Record<TxType, Partial<Record<Side, string>>> = {
  deposit: { source: REVENUE },
  transfer: {},
  withdrawal: { destination: EXPENSE },
};

export const SHARED: Record<TxType, Record<Side, boolean>> = {
  deposit: { destination: true, source: false },
  transfer: { destination: true, source: true },
  withdrawal: { destination: false, source: true },
};

export const OWN_SIDE: Record<TxType, Side> = {
  deposit: "destination",
  transfer: "source",
  withdrawal: "source",
};

const ROUTES: Record<TxType, Record<string, string[]>> = {
  deposit: {
    [CASH]: [ASSET, ...LIABILITIES],
    [REVENUE]: [ASSET, ...LIABILITIES],
    ...Object.fromEntries(LIABILITIES.map((kind) => [kind, [ASSET]])),
  },
  transfer: {
    [ASSET]: [ASSET],
    ...Object.fromEntries(LIABILITIES.map((kind) => [kind, LIABILITIES])),
  },
  withdrawal: {
    [ASSET]: [EXPENSE, ...LIABILITIES, CASH],
    ...Object.fromEntries(LIABILITIES.map((kind) => [kind, [EXPENSE, CASH]])),
  },
};

export const fits = (type: TxType, source: string, destination: string) =>
  ROUTES[type][source]?.includes(destination) ?? false;

export const typeFor = (source: string, destination: string) =>
  TX_TYPES.find((type) => fits(type, source, destination)) ?? null;

const SHORT_KIND: Record<string, string> = {
  asset: ASSET,
  cash: CASH,
  expense: EXPENSE,
  revenue: REVENUE,
};

export function accountKind(account: Account): string {
  if (account.type === "liabilities" || account.type === "liability") {
    const type = account.liability_type ?? "debt";
    return type[0].toUpperCase() + type.slice(1);
  }
  return SHORT_KIND[account.type] ?? account.type;
}

export const accountCurrency = (account: Account): Cur | null =>
  account.currency_code
    ? {
        code: account.currency_code,
        decimals: account.currency_decimal_places ?? 2,
        symbol: account.currency_symbol ?? account.currency_code,
      }
    : null;

export const toAccountRef = (item: Item<Account>): AccountRef => ({
  currency: accountCurrency(item.attributes),
  id: item.id,
  kind: accountKind(item.attributes),
  name: item.attributes.name,
});

export function kindOf(type: TxType, side: Side, ref: AccountRef): string {
  if (ref.id) {
    return ref.kind;
  }
  const free = FREE_KIND[type][side];
  if (!free) {
    return "";
  }
  return ref.name.trim() ? free : CASH;
}

let lastKey = 0;
const nextKey = () => {
  lastKey += 1;
  return lastKey;
};

export const emptyRef = (): Ref => ({ id: null, name: "" });
export const emptyAccount = (): AccountRef => ({
  currency: null,
  id: null,
  kind: "",
  name: "",
});

export function emptySplit(): SplitForm {
  return {
    amount: "",
    bill: emptyRef(),
    budget: emptyRef(),
    category: "",
    currency: null,
    dates: Object.fromEntries(META_DATES.map((key) => [key, ""])) as Record<
      MetaDate,
      string
    >,
    description: "",
    destination: emptyAccount(),
    externalUrl: "",
    foreignAmount: "",
    foreignCurrency: null,
    internalReference: "",
    journalId: null,
    key: nextKey(),
    notes: "",
    piggy: emptyRef(),
    reconciled: false,
    source: emptyAccount(),
    tags: [],
  };
}

export const emptyForm = (type: TxType): Form => ({
  date: today(),
  splits: [emptySplit()],
  time: "",
  title: "",
  type,
});

const cur = (
  code: string | null | undefined,
  symbol: string | null | undefined,
  decimals: number | null | undefined
): Cur | null =>
  code ? { code, decimals: decimals ?? 2, symbol: symbol ?? code } : null;

const toRef = (
  id: string | null | undefined,
  name: string | null | undefined
) => (id ? { id, name: name ?? "" } : emptyRef());

function accountFrom(
  id: string | null,
  name: string | null | undefined,
  kind: string | undefined,
  currency: Cur | null
): AccountRef {
  if (kind === CASH || !id) {
    return { ...emptyAccount(), kind: CASH };
  }
  return { currency, id, kind: kind ?? "", name: name ?? "" };
}

const fixed = (value: string | null | undefined, decimals: number) =>
  value ? Number(value).toFixed(decimals) : "";

function fromSplit(split: Split, clone: boolean): SplitForm {
  const currency = cur(
    split.currency_code,
    split.currency_symbol,
    split.currency_decimal_places
  );
  const foreign = split.foreign_amount
    ? cur(
        split.foreign_currency_code,
        split.foreign_currency_symbol,
        split.foreign_currency_decimal_places
      )
    : null;
  const own = split.type === "deposit" ? "destination" : "source";
  const otherCurrency =
    split.type === "transfer" ? (foreign ?? currency) : null;
  return {
    ...emptySplit(),
    amount: fixed(split.amount, currency?.decimals ?? 2),
    bill: toRef(split.bill_id, split.bill_name),
    budget: toRef(split.budget_id, split.budget_name),
    category: split.category_name ?? "",
    currency,
    dates: Object.fromEntries(
      META_DATES.map((key) => [key, split[key]?.slice(0, 10) ?? ""])
    ) as Record<MetaDate, string>,
    description: split.description,
    destination: accountFrom(
      split.destination_id,
      split.destination_name,
      split.destination_type,
      own === "destination" ? currency : otherCurrency
    ),
    externalUrl: split.external_url ?? "",
    foreignAmount: foreign ? fixed(split.foreign_amount, foreign.decimals) : "",
    foreignCurrency: foreign,
    internalReference: split.internal_reference ?? "",
    journalId: clone ? null : (split.transaction_journal_id ?? null),
    notes: split.notes ?? "",
    reconciled: clone ? false : Boolean(split.reconciled),
    source: accountFrom(
      split.source_id,
      split.source_name,
      split.source_type,
      own === "source" ? currency : null
    ),
    tags: split.tags ?? [],
  };
}

export const isEditableType = (type: string): type is TxType =>
  (TX_TYPES as string[]).includes(type);

export function fromGroup(group: Item<TransactionGroup>, clone = false): Form {
  const splits = group.attributes.transactions;
  const [first] = splits;
  return {
    date: clone ? today() : first.date.slice(0, 10),
    splits: splits.map((split) => fromSplit(split, clone)),
    time: clone ? "" : first.date.slice(11),
    title: group.attributes.group_title ?? "",
    type: isEditableType(first.type) ? first.type : "withdrawal",
  };
}

function accountFields(side: Side, value: AccountRef) {
  if (value.id) {
    return { [`${side}_id`]: value.id };
  }
  const name = value.name.trim();
  return name ? { [`${side}_name`]: name } : {};
}

export const sideOf = (form: Form, split: SplitForm, side: Side) =>
  SHARED[form.type][side] ? form.splits[0][side] : split[side];

export function hasForeign(split: SplitForm): boolean {
  return Boolean(
    split.foreignCurrency && split.foreignCurrency.code !== split.currency?.code
  );
}

function splitPayload(form: Form, split: SplitForm, update: boolean) {
  const withdrawal = form.type === "withdrawal";
  const body: Record<string, unknown> = {
    bill_id: withdrawal ? split.bill.id : null,
    budget_id: withdrawal ? split.budget.id : null,
    category_name: split.category.trim() || null,
    date: form.time ? `${form.date}T${form.time}` : form.date,
    description: split.description.trim(),
    external_url: split.externalUrl.trim() || null,
    internal_reference: split.internalReference.trim() || null,
    notes: split.notes.trim() || null,
    tags: split.tags,
    type: form.type,
  };
  for (const key of META_DATES) {
    body[key] = split.dates[key] || null;
  }
  if (update && split.journalId) {
    body.transaction_journal_id = split.journalId;
  }
  if (!(update || split.piggy.id === null)) {
    body.piggy_bank_id = split.piggy.id;
  }
  if (split.reconciled) {
    return body;
  }
  const foreign = hasForeign(split) && split.foreignAmount.trim() !== "";
  let foreignAmount = update ? "0" : null;
  if (foreign) {
    foreignAmount = amountString(
      split.foreignAmount,
      split.foreignCurrency?.decimals ?? 2
    );
  }
  return {
    ...body,
    ...accountFields("source", sideOf(form, split, "source")),
    ...accountFields("destination", sideOf(form, split, "destination")),
    amount: amountString(split.amount, split.currency?.decimals ?? 2),
    currency_code: split.currency?.code,
    foreign_amount: foreignAmount,
    foreign_currency_code: foreign ? split.foreignCurrency?.code : null,
  };
}

const dropEmpty = (body: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(body).filter(
      ([, value]) => value !== null && value !== undefined
    )
  );

export interface SubmitOptions {
  applyRules: boolean;
  fireWebhooks: boolean;
}

export function groupTitle(form: Form): string | null {
  if (form.splits.length < 2) {
    return null;
  }
  return form.title.trim() || form.splits[0].description.trim();
}

export function toPayload(form: Form, update: boolean, options: SubmitOptions) {
  const splits = form.splits.map((split) => splitPayload(form, split, update));
  return {
    apply_rules: options.applyRules,
    fire_webhooks: options.fireWebhooks,
    group_title: groupTitle(form),
    ...(update ? {} : { error_if_duplicate_hash: false }),
    transactions: update ? splits : splits.map(dropEmpty),
  };
}

export type Errors = Record<string, string[]>;

const ACCOUNT_FIELDS: Record<Side, string[]> = {
  destination: ["destination_id", "destination_name"],
  source: ["source_id", "source_name"],
};

export function fieldError(
  errors: Errors,
  index: number,
  field: string
): string {
  const keys = ACCOUNT_FIELDS[field as Side] ?? [field];
  for (const key of keys) {
    const found = errors[`transactions.${index}.${key}`];
    if (found?.length) {
      return found[0];
    }
  }
  return "";
}

function accountProblem(
  form: Form,
  split: SplitForm,
  side: Side
): string | null {
  const value = sideOf(form, split, side);
  if (value.id) {
    return KINDS[form.type][side].includes(value.kind)
      ? null
      : `A ${value.kind.toLowerCase()} can't be the ${side} of a ${form.type}`;
  }
  if (FREE_KIND[form.type][side]) {
    return null;
  }
  return value.name.trim()
    ? `No ${KINDS[form.type][side][0].toLowerCase()} or liability called "${value.name.trim()}"`
    : `Choose the ${side} account`;
}

export function mismatch(
  form: Form
): { from: string; to: string; suggest: TxType | null } | null {
  for (const split of form.splits) {
    const source = kindOf(form.type, "source", sideOf(form, split, "source"));
    const destination = kindOf(
      form.type,
      "destination",
      sideOf(form, split, "destination")
    );
    if (source && destination && !fits(form.type, source, destination)) {
      return {
        from: source,
        suggest: typeFor(source, destination),
        to: destination,
      };
    }
  }
  return null;
}

type Problems = [string, string][];

function foreignProblems(form: Form, split: SplitForm): Problems {
  const foreign = split.foreignAmount.trim();
  const problems: Problems = [];
  if (hasForeign(split) && !foreign) {
    problems.push([
      "foreign_amount",
      form.type === "transfer"
        ? `Enter the amount in ${split.foreignCurrency?.code}`
        : "Enter the foreign amount or clear the currency",
    ]);
  }
  if (foreign && !hasForeign(split)) {
    problems.push(["foreign_currency_code", "Choose the foreign currency"]);
  }
  if (foreign && (evalAmount(foreign) ?? 0) <= 0) {
    problems.push(["foreign_amount", "The amount must be a positive number"]);
  }
  return problems;
}

function moneyProblems(form: Form, split: SplitForm, index: number): Problems {
  const problems: Problems = [];
  const amount = evalAmount(split.amount);
  if (amount === null || amount <= 0) {
    problems.push([
      "amount",
      split.amount.trim()
        ? "The amount must be a positive number"
        : "Enter an amount",
    ]);
  }
  for (const side of ["source", "destination"] as Side[]) {
    const problem =
      index === 0 || !SHARED[form.type][side]
        ? accountProblem(form, split, side)
        : null;
    if (problem) {
      problems.push([`${side}_id`, problem]);
    }
  }
  const source = sideOf(form, split, "source");
  if (source.id && source.id === sideOf(form, split, "destination").id) {
    problems.push([
      "destination_id",
      "Source and destination are the same account",
    ]);
  }
  problems.push(...foreignProblems(form, split));
  return problems;
}

function linkProblems(form: Form, split: SplitForm): Problems {
  const withdrawal = form.type === "withdrawal";
  const loose = (value: Ref) => !value.id && value.name.trim() !== "";
  const checks: [boolean, string, string][] = [
    [withdrawal && loose(split.budget), "budget_id", "Pick an existing budget"],
    [
      withdrawal && loose(split.bill),
      "bill_id",
      "Pick an existing subscription",
    ],
    [loose(split.piggy), "piggy_bank_id", "Pick an existing piggy bank"],
  ];
  return checks
    .filter(([failed]) => failed)
    .map(([, field, message]) => [field, message]);
}

export function validate(form: Form): Errors {
  const errors: Errors = {};
  if (!form.date) {
    errors["transactions.0.date"] = [
      "Enter a date like today, -1, 14.10 or 2026-10-14",
    ];
  }
  form.splits.forEach((split, index) => {
    const problems: Problems = [
      ...(index === 0 && !split.description.trim()
        ? ([["description", "Describe the transaction"]] as Problems)
        : []),
      ...(split.reconciled ? [] : moneyProblems(form, split, index)),
      ...linkProblems(form, split),
    ];
    for (const [field, message] of problems) {
      errors[`transactions.${index}.${field}`] = [message];
    }
  });
  return errors;
}

export function switchType(form: Form, to: TxType) {
  const from = form.type;
  if (from === to) {
    return;
  }
  for (const split of form.splits) {
    const own = split[OWN_SIDE[from]];
    const other = split[OWN_SIDE[from] === "source" ? "destination" : "source"];
    const ownSide = OWN_SIDE[to];
    const otherSide: Side = ownSide === "source" ? "destination" : "source";
    split[ownSide] = own;
    split[otherSide] = adapt(other, to, otherSide);
  }
  form.type = to;
}

function adapt(value: AccountRef, type: TxType, side: Side): AccountRef {
  if (value.id && KINDS[type][side].includes(value.kind)) {
    return value;
  }
  if (FREE_KIND[type][side] && value.name.trim()) {
    return { ...emptyAccount(), name: value.name };
  }
  return emptyAccount();
}

export function total(form: Form): { amount: number; currency: Cur | null }[] {
  const sums = new Map<string, { amount: number; currency: Cur | null }>();
  for (const split of form.splits) {
    const code = split.currency?.code ?? "";
    const entry = sums.get(code) ?? { amount: 0, currency: split.currency };
    entry.amount += evalAmount(split.amount) ?? 0;
    sums.set(code, entry);
  }
  return [...sums.values()];
}
