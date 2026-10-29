import { api } from "#lib/api/client.js";
import type { One, Split, TransactionGroup } from "#lib/api/types.js";
import { type Group, groupTitle, journalId } from "./split.js";

export type Patch = Record<string, unknown>;
export type Targets = Map<string, Set<string> | null>;
export type Mode = "category" | "budget" | "bill" | "tag" | "untag";

export interface MassAction {
  id: string | null;
  mode: Mode;
  value: string | null;
}

export const MODES: {
  keys: string;
  label: string;
  mode: Mode;
  none?: string;
  verb: string;
}[] = [
  {
    keys: "s c",
    label: "Category",
    mode: "category",
    none: "(no category)",
    verb: "Set category",
  },
  {
    keys: "s b",
    label: "Budget",
    mode: "budget",
    none: "(no budget)",
    verb: "Set budget",
  },
  {
    keys: "s s",
    label: "Subscription",
    mode: "bill",
    none: "(no subscription)",
    verb: "Set subscription",
  },
  { keys: "s t", label: "Add tag", mode: "tag", verb: "Add tag" },
  { keys: "s T", label: "Remove tag", mode: "untag", verb: "Remove tag" },
];

const MODE = Object.fromEntries(MODES.map((m) => [m.mode, m]));

export function actionLabel(action: MassAction): string {
  const { verb, none } = MODE[action.mode];
  return `${verb} “${action.value ?? none}”`;
}

export function patchFor({
  mode,
  value,
  id,
}: MassAction): (split: Split) => Patch | null {
  switch (mode) {
    case "budget":
      return (split) =>
        split.type !== "withdrawal" || (split.budget_id ?? null) === id
          ? null
          : { budget_id: id };
    case "bill":
      return (split) =>
        split.type !== "withdrawal" || (split.bill_id ?? null) === id
          ? null
          : { bill_id: id };
    case "category":
      return (split) =>
        (split.category_name ?? null) === value
          ? null
          : { category_name: value };
    case "tag":
      return (split) =>
        !value || split.tags?.includes(value)
          ? null
          : { tags: [...(split.tags ?? []), value] };
    default:
      return (split) =>
        value && split.tags?.includes(value)
          ? { tags: split.tags.filter((tag) => tag !== value) }
          : null;
  }
}

export interface Row {
  count: number;
  group: Group;
  key: string;
  kind: "single" | "head" | "split";
  split?: Split;
}

export interface Outcome {
  done: number;
  errors: string[];
  total: number;
}

export function buildRows(groups: Group[], collapsed: Set<string>): Row[] {
  const rows: Row[] = [];
  for (const group of groups) {
    const splits = group.attributes.transactions;
    const count = splits.length;
    if (count === 1) {
      rows.push({
        count,
        group,
        key: group.id,
        kind: "single",
        split: splits[0],
      });
      continue;
    }
    rows.push({ count, group, key: group.id, kind: "head" });
    if (collapsed.has(group.id)) {
      continue;
    }
    for (const split of splits) {
      rows.push({
        count,
        group,
        key: `${group.id}:${journalId(split)}`,
        kind: "split",
        split,
      });
    }
  }
  return rows;
}

export function targetsOf(rows: Row[]): Targets {
  const targets: Targets = new Map();
  for (const row of rows) {
    const set = targets.get(row.group.id) ?? new Set<string>();
    const splits = row.split ? [row.split] : row.group.attributes.transactions;
    for (const split of splits) {
      set.add(journalId(split));
    }
    targets.set(row.group.id, set);
  }
  return targets;
}

export function splitsOf(rows: Row[]): Split[] {
  return rows.flatMap((row) =>
    row.split ? [row.split] : row.group.attributes.transactions
  );
}

async function load(id: string) {
  const fresh = await api<One<TransactionGroup>>(`/v1/transactions/${id}`);
  return fresh.data;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function each(
  targets: Targets,
  run: (id: string, journals: Set<string> | null) => Promise<void>,
  progress: (outcome: Outcome) => void
): Promise<Outcome> {
  const outcome: Outcome = { done: 0, errors: [], total: targets.size };
  progress(outcome);
  await Promise.all(
    [...targets].map(async ([id, journals]) => {
      try {
        await run(id, journals);
        outcome.done += 1;
      } catch (error) {
        outcome.errors.push(`#${id}: ${message(error)}`);
      }
      progress({ ...outcome });
    })
  );
  return outcome;
}

export function updateGroups(
  targets: Targets,
  patch: (split: Split) => Patch | null,
  progress: (outcome: Outcome) => void
): Promise<Outcome> {
  return each(
    targets,
    async (id, journals) => {
      const fresh = await load(id);
      const splits = fresh.attributes.transactions;
      let changed = false;
      const transactions = splits.map((split) => {
        const hit = journals === null || journals.has(journalId(split));
        const change = hit ? patch(split) : null;
        changed ||= change !== null;
        return { transaction_journal_id: journalId(split), ...change };
      });
      if (!changed) {
        return;
      }
      await api(`/v1/transactions/${id}`, {
        body: {
          transactions,
          ...(splits.length > 1 && { group_title: groupTitle(fresh) }),
        },
        method: "PUT",
      });
    },
    progress
  );
}

export function deleteTargets(
  targets: Targets,
  progress: (outcome: Outcome) => void
): Promise<Outcome> {
  return each(
    targets,
    async (id, journals) => {
      const fresh = await load(id);
      const whole =
        journals === null ||
        fresh.attributes.transactions.every((split) =>
          journals.has(journalId(split))
        );
      if (whole) {
        await api(`/v1/transactions/${id}`, { method: "DELETE" });
        return;
      }
      await [...journals].reduce(
        (chain, journal) =>
          chain.then(() =>
            api(`/v1/transaction-journals/${journal}`, { method: "DELETE" })
          ),
        Promise.resolve()
      );
    },
    progress
  );
}
