import { createQuery } from "@tanstack/svelte-query";
import { getContext, setContext } from "svelte";
import { lists } from "#lib/api/lists.js";
import type { Account, Item, TransactionGroup } from "#lib/api/types.js";
import { formatMoney } from "#lib/format.js";
import { session } from "#lib/session.svelte.js";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import {
  displayCode,
  displayFlows,
  inDisplay,
  isApprox,
  plainCode,
} from "./display.js";
import {
  type Dimension,
  exchanges,
  type Flow,
  matches,
  modes,
  toFlows,
  total,
} from "./flows.js";
import {
  ALL_ASSETS,
  grainOf,
  kindOf,
  type ReportParams,
  reportPath,
  templateOf,
} from "./params.js";
import { reportQueries } from "./queries.js";

export interface Option {
  group?: string;
  id: string;
  label: string;
  note?: string;
}

const ROLE_GROUPS: Record<string, string> = {
  cashWalletAsset: "Cash wallets",
  ccAsset: "Credit cards",
  defaultAsset: "Default asset accounts",
  savingAsset: "Savings accounts",
  sharedAsset: "Shared asset accounts",
};

const LIABILITY_GROUP: Record<string, string> = {
  debt: "Liability: Debt",
  loan: "Liability: Loan",
  mortgage: "Liability: Mortgage",
};

export const LIST_LENGTH = 10;

export function accountOptions(accounts: Item<Account>[]): Option[] {
  return accounts
    .map((item) => {
      const a = item.attributes;
      const group =
        a.type === "liabilities" || a.type === "liability"
          ? (LIABILITY_GROUP[a.liability_type ?? ""] ?? "Liabilities")
          : (ROLE_GROUPS[a.account_role ?? ""] ?? "Default asset accounts");
      const shared = a.account_role === "sharedAsset" ? " (shared)" : "";
      return {
        group,
        id: item.id,
        label: `${a.name}${shared}`,
        note: [a.currency_code, a.active ? "" : "inactive"]
          .filter(Boolean)
          .join(" · "),
      };
    })
    .sort(
      (a, b) =>
        (a.group ?? "").localeCompare(b.group ?? "") ||
        a.label.localeCompare(b.label)
    );
}

export const isLiability = (account: Account) =>
  account.type === "liabilities" || account.type === "liability";

export function allAssetIds(accounts: Item<Account>[]): string[] {
  return accounts.filter((a) => a.attributes.active).map((a) => a.id);
}

export function currencyMeta(code: string) {
  const plain = plainCode(code);
  const found = session.currencies.find((c) => c.attributes.code === plain);
  return {
    code: plain,
    decimals: found?.attributes.decimal_places ?? 2,
    symbol: found?.attributes.symbol ?? plain,
  };
}

export function money(
  code: string,
  amount: number,
  signed = false,
  decimals?: number
) {
  const { primary } = session;
  const meta =
    code === "pc" && primary
      ? {
          code: primary.code,
          decimals: primary.decimal_places,
          symbol: primary.symbol,
        }
      : currencyMeta(code);
  const text = formatMoney(
    { amount, ...meta, decimals: decimals ?? meta.decimals },
    signed
  );
  return isApprox(code) ? `≈${text}` : text;
}

export function displayMoney(
  code: string,
  amount: number,
  signed = false,
  decimals?: number
) {
  const shown = inDisplay(amount, code);
  return money(shown.code, shown.amount, signed, decimals);
}

export function modeLabel(mode: string) {
  return mode === "pc" ? `All in ${session.primary?.code ?? ""}` : mode;
}

export function navigate(
  changes: Record<string, string | null>,
  path?: string
) {
  const url = new URL(page.url.href);
  if (path) {
    url.pathname = path;
  }
  for (const [name, value] of Object.entries(changes)) {
    if (value === null || value === "") {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, value);
    }
  }
  return goto(url, { replace: true, reset: false });
}

export interface Drill {
  asset?: string;
  at?: string;
  box: string;
  currency?: string;
  dim?: Dimension | "day" | "flow";
  dir?: 1 | -1;
  key?: string;
  label: string;
}

const DRILL_DIMS = new Set([
  "asset",
  "bill",
  "budget",
  "category",
  "name",
  "other",
  "tag",
  "day",
  "flow",
]);

const DIRS: Record<string, 1 | -1> = { in: 1, out: -1 };
const DIR_NAMES = { "-1": "out", "1": "in" } as const;

function readDrill(url: {
  searchParams: { get: (name: string) => string | null };
}): Drill | null {
  const box = url.searchParams.get("box");
  if (!box) {
    return null;
  }
  const raw = url.searchParams.get("drill") ?? "";
  const split = raw.indexOf(":");
  const dim = split > 0 ? raw.slice(0, split) : "";
  const dir = url.searchParams.get("dir");
  return {
    asset: url.searchParams.get("acc") ?? undefined,
    at: url.searchParams.get("at") ?? undefined,
    box,
    currency: url.searchParams.get("dc") ?? undefined,
    dim: DRILL_DIMS.has(dim) ? (dim as Drill["dim"]) : undefined,
    dir: DIRS[dir ?? ""],
    key: split > 0 ? raw.slice(split + 1) : undefined,
    label: url.searchParams.get("dl") ?? "",
  };
}

export function drillQuery(drill: Drill | null): Record<string, string | null> {
  if (!drill) {
    return {
      acc: null,
      at: null,
      box: null,
      dc: null,
      dir: null,
      dl: null,
      drill: null,
    };
  }
  return {
    acc: drill.asset ?? null,
    at: drill.at ?? null,
    box: drill.box,
    dc: drill.currency ?? null,
    dir: drill.dir ? DIR_NAMES[drill.dir] : null,
    dl: drill.label || null,
    drill:
      drill.dim && drill.key !== undefined ? `${drill.dim}:${drill.key}` : null,
  };
}

export function drillFilter(
  drill: Drill,
  bucketOf: (date: string) => string
): (flow: Flow) => boolean {
  return (flow) => {
    if (drill.dir && flow.dir !== drill.dir) {
      return false;
    }
    if (drill.at && bucketOf(flow.date) !== drill.at) {
      return false;
    }
    if (drill.asset && flow.asset.id !== drill.asset) {
      return false;
    }
    if (drill.currency && flow.currency !== drill.currency) {
      return false;
    }
    if (!drill.dim || drill.key === undefined) {
      return true;
    }
    if (drill.dim === "day") {
      return flow.date === drill.key;
    }
    if (drill.dim === "flow") {
      return flow.journal === drill.key;
    }
    return matches(flow, drill.dim, drill.key);
  };
}

function twins(
  ids: string[],
  expense: Item<Account>[],
  revenue: Item<Account>[]
): Set<string> {
  const pool = [...expense, ...revenue];
  const chosen = pool.filter((a) => ids.includes(a.id));
  const names = new Set(chosen.map((a) => a.attributes.name.toLowerCase()));
  const ibans = new Set(
    chosen
      .map((a) => a.attributes.iban)
      .filter((iban): iban is string => !!iban)
  );
  return new Set(
    pool
      .filter(
        (a) =>
          ids.includes(a.id) ||
          names.has(a.attributes.name.toLowerCase()) ||
          (a.attributes.iban && ibans.has(a.attributes.iban))
      )
      .map((a) => a.id)
  );
}

const inRange = (group: Item<TransactionGroup>, start: string, end: string) => {
  const date = group.attributes.transactions[0]?.date.slice(0, 10) ?? "";
  return date >= start && date <= end;
};

export function createReport(
  params: () => ReportParams,
  source?: () => Item<TransactionGroup>[] | undefined,
  target?: () => string | null
) {
  const p = $derived(params());
  const kind = $derived(kindOf(p.type));
  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));
  const budgets = createQuery(() => ({
    ...lists.budgets(),
    enabled: p.type === "budget" || p.type === "default",
  }));
  const categories = createQuery(() => ({
    ...lists.categories(),
    enabled: p.type === "category",
  }));
  const tags = createQuery(() => ({
    ...lists.tags(),
    enabled: p.type === "tag",
  }));
  const expense = createQuery(() => ({
    ...lists.accounts("expense"),
    enabled: p.type === "double",
  }));
  const revenue = createQuery(() => ({
    ...lists.accounts("revenue"),
    enabled: p.type === "double",
  }));
  const tx = createQuery(() => ({
    ...reportQueries.transactions(p.start, p.end),
    enabled: !source && p.type !== "audit",
  }));
  const groups = $derived(
    source
      ? source()?.filter((group) => inRange(group, p.start, p.end))
      : tx.data
  );

  const accounts = $derived([
    ...(assets.data ?? []),
    ...(liabilities.data ?? []),
  ]);
  const accountsReady = $derived(!!(assets.data && liabilities.data));
  const byId = $derived(new Map(accounts.map((a) => [a.id, a.attributes])));
  const selected = $derived(
    p.accounts.includes(ALL_ASSETS) ? allAssetIds(accounts) : p.accounts
  );
  const selectedSet = $derived(new Set(selected));
  const items = $derived.by(() => {
    const raw = p.items;
    if (p.type === "budget") {
      return raw.includes("allBudgets")
        ? (budgets.data ?? [])
            .filter((b) => b.attributes.active)
            .map((b) => b.id)
        : raw;
    }
    if (p.type === "category") {
      return raw.includes("allCategories")
        ? (categories.data ?? []).map((c) => c.id)
        : raw;
    }
    if (p.type === "tag") {
      const list = tags.data ?? [];
      if (raw.includes("allTags")) {
        return list.map((t) => t.id);
      }
      return raw.map(
        (value) =>
          list.find(
            (t) =>
              t.id === value ||
              t.attributes.tag.toLowerCase() === value.toLowerCase()
          )?.id ?? value
      );
    }
    return raw;
  });
  const itemSet = $derived(new Set(items));
  const itemNames = $derived.by(() => {
    const names = new Map<string, string>();
    for (const b of budgets.data ?? []) {
      names.set(`budget:${b.id}`, b.attributes.name);
    }
    for (const c of categories.data ?? []) {
      names.set(`category:${c.id}`, c.attributes.name);
    }
    for (const t of tags.data ?? []) {
      names.set(`tag:${t.id}`, t.attributes.tag);
    }
    for (const a of [...(expense.data ?? []), ...(revenue.data ?? [])]) {
      names.set(`double:${a.id}`, a.attributes.name);
    }
    return names;
  });
  const tagNames = $derived(
    new Set(
      (tags.data ?? [])
        .filter((t) => itemSet.has(t.id))
        .map((t) => t.attributes.tag)
    )
  );
  const counterparts = $derived(
    p.type === "double"
      ? twins(items, expense.data ?? [], revenue.data ?? [])
      : new Set<string>()
  );

  const raw = $derived(
    groups && accountsReady
      ? toFlows(groups, selectedSet, (id) => byId.get(id)?.currency_code)
      : undefined
  );
  const into = $derived.by(() => {
    if (target) {
      return target();
    }
    return raw ? displayCode(new Set(raw.map((flow) => flow.currency))) : null;
  });
  const flows = $derived(raw && displayFlows(raw, into));

  const swaps = $derived(
    groups && accountsReady
      ? exchanges(groups, selectedSet, (id) => byId.get(id)?.currency_code)
      : []
  );

  const listReady = $derived(
    {
      audit: true,
      budget: !!budgets.data,
      category: !!categories.data,
      default: true,
      double: !!(expense.data && revenue.data),
      tag: !!tags.data,
    }[p.type]
  );

  const scoped = $derived.by(() => {
    if (!(flows && listReady)) {
      return;
    }
    switch (p.type) {
      case "budget":
        return flows.filter(
          (f) => f.dir === -1 && f.budget && itemSet.has(f.budget.id)
        );
      case "category":
        return flows.filter((f) => f.category && itemSet.has(f.category.id));
      case "tag":
        return flows.filter((f) => f.tags.some((t) => tagNames.has(t)));
      case "double":
        return flows.filter((f) => counterparts.has(f.other.id));
      default:
        return flows;
    }
  });

  const totals = $derived(scoped ? total(scoped) : undefined);
  const codes = $derived.by(() => {
    const primary = session.primary?.code;
    const all = session.currencies.map((c) => c.attributes.code);
    const ordered = primary
      ? [primary, ...all.filter((c) => c !== primary)]
      : all;
    return into ? [into, ...ordered] : ordered;
  });
  const available = $derived(totals ? modes(totals, codes) : []);
  const mode = $derived.by(() => {
    const wanted = page.url.searchParams.get("cur");
    if (wanted && available.includes(wanted)) {
      return wanted;
    }
    return available[0] ?? session.primary?.code ?? "";
  });
  const grain = $derived(grainOf(p.start, p.end));
  const template = $derived(templateOf(p.start, p.end));
  const drill = $derived(readDrill(page.url));
  const delta = $derived(page.url.searchParams.get("delta"));

  return {
    accounts: () => accounts,
    get accountsReady() {
      return accountsReady;
    },
    get available() {
      return available;
    },
    get budgets() {
      return budgets.data;
    },
    byId: () => byId,
    get categories() {
      return categories.data;
    },
    get codes() {
      return codes;
    },
    get counterparts() {
      return counterparts;
    },
    get delta() {
      return delta;
    },
    get drill() {
      return drill;
    },
    get error() {
      return tx.error ?? assets.error ?? null;
    },
    get exchanges() {
      return swaps;
    },
    get expense() {
      return expense.data;
    },
    get flows() {
      return flows;
    },
    get grain() {
      return grain;
    },
    get groups() {
      return groups;
    },
    get into() {
      return into;
    },
    itemName: (kindKey: string, id: string) =>
      itemNames.get(`${kindKey}:${id}`),
    get items() {
      return items;
    },
    get kind() {
      return kind;
    },
    get mode() {
      return mode;
    },
    get params() {
      return p;
    },
    path: (changes: Partial<ReportParams>) => reportPath({ ...p, ...changes }),
    get revenue() {
      return revenue.data;
    },
    get scoped() {
      return scoped;
    },
    get selected() {
      return selected;
    },
    get tags() {
      return tags.data;
    },
    get template() {
      return template;
    },
    get totals() {
      return totals;
    },
  };
}

export type Report = ReturnType<typeof createReport>;

const KEY = Symbol("report");

export const provideReport = (report: Report) => setContext(KEY, report);
export const useReport = () => getContext<Report>(KEY);
