import { type CreateQueryResult, createQuery } from "@tanstack/svelte-query";
import { lists } from "#lib/api/lists.js";
import type { Account, Item, Split, TransactionGroup } from "#lib/api/types.js";
import { contains, type Range, today } from "#lib/dates.js";
import { period } from "#lib/period.svelte.js";
import { monthOf } from "#lib/reports/board.js";
import { displayCode, displayFlows } from "#lib/reports/display.js";
import { buckets, type Flow } from "#lib/reports/flows.js";
import { ledgerQuery, ledgerWindow, ownFlows } from "#lib/reports/ledger.js";
import { pages } from "#lib/reports/queries.js";
import { impliedRates } from "#lib/reports/rates.js";
import { typicalMonths } from "#lib/reports/typical.js";
import { session } from "#lib/session.svelte.js";
import type { Group } from "#lib/transactions/split.js";
import type { Spec } from "./spec.js";
import { codesOf, dirOf, factsOf, normsOf, weigh } from "./stats.js";

export interface Args {
  allTime?: boolean;
  everything?: boolean;
  spec: Spec;
}

interface Kept {
  groups: Group[];
  journals: Set<string>;
}

function keptOf(
  groups: Group[],
  keep: (split: Split) => boolean,
  range: Range | null
): Kept {
  const journals = new Set<string>();
  const kept: Group[] = [];
  for (const group of groups) {
    let hit = false;
    for (const split of group.attributes.transactions) {
      if (keep(split) && (!range || contains(range, split.date.slice(0, 10)))) {
        journals.add(String(split.transaction_journal_id));
        hit = true;
      }
    }
    if (hit) {
      kept.push(group);
    }
  }
  return { groups: kept, journals };
}

const flowsOf = (kept: Kept, accounts: Item<Account>[]): Flow[] =>
  ownFlows(kept.groups, accounts).filter((flow) =>
    kept.journals.has(flow.journal)
  );

export class DimensionModel {
  readonly now = today();
  readonly args: () => Args;
  readonly ledger: CreateQueryResult<Group[]>;
  readonly accounts: CreateQueryResult<Item<Account>[]>;
  readonly source: CreateQueryResult<Group[]>;

  spec = $derived.by(() => this.args().spec);
  everything = $derived.by(() => Boolean(this.args().everything));
  allTime = $derived.by(() => this.everything || Boolean(this.args().allTime));
  range = $derived<Range | null>(this.everything ? null : period.range);
  anchor = $derived(
    this.range && this.range.end < ledgerWindow(this.now).start
      ? this.range.end
      : this.now
  );
  window = $derived(ledgerWindow(this.anchor));
  inside = $derived(
    this.range !== null &&
      this.range.start >= this.window.start &&
      this.range.end <= this.window.end
  );
  sourceRange = $derived(this.allTime ? null : this.range);

  raw = $derived.by(
    () =>
      (this.allTime ? this.source.data : this.ledger.data) ?? ([] as Group[])
  );
  loading = $derived.by(
    () =>
      this.accounts.isPending ||
      (this.allTime ? this.source.isPending : this.ledger.isPending) ||
      (!(this.allTime || this.inside) && this.source.isPending)
  );
  base = $derived(keptOf(this.raw, this.spec.keep, null));
  inPeriod = $derived.by(() => {
    if (this.everything) {
      return this.base;
    }
    const from =
      this.allTime || this.inside ? this.raw : (this.source.data ?? []);
    return keptOf(from, this.spec.keep, this.range);
  });
  groups = $derived(this.inPeriod.groups);
  rawFlows = $derived.by(() => flowsOf(this.base, this.accounts.data ?? []));
  rawPeriod = $derived.by(() =>
    flowsOf(this.inPeriod, this.accounts.data ?? [])
  );
  into = $derived.by(() =>
    displayCode(
      new Set(
        [...this.rawFlows, ...this.rawPeriod].map((flow) => flow.currency)
      )
    )
  );
  flows = $derived(displayFlows(this.rawFlows, this.into));
  periodFlows = $derived(displayFlows(this.rawPeriod, this.into));
  dir = $derived(dirOf(this.flows.length > 0 ? this.flows : this.periodFlows));
  main = $derived(this.flows.filter((flow) => flow.dir === this.dir));
  periodMain = $derived(
    this.periodFlows.filter((flow) => flow.dir === this.dir)
  );
  codes = $derived(codesOf([...this.main, ...this.periodMain]));
  history = $derived(factsOf(this.main, this.codes));
  months = $derived(
    this.everything && this.history.first
      ? buckets(this.history.first, this.now, "month")
      : this.window.months
  );
  typicalMonths = $derived(
    typicalMonths(this.months, this.now, period.first ?? this.history.first)
  );
  focus = $derived(
    this.range && monthOf(this.range.start) === monthOf(this.range.end)
      ? monthOf(this.range.start)
      : null
  );
  partial = $derived(
    this.months.includes(monthOf(this.now)) ? monthOf(this.now) : null
  );
  norms = $derived(
    normsOf(this.main, this.codes, this.typicalMonths, this.focus, this.now)
  );
  facts = $derived(factsOf(this.periodMain, this.codes));
  weight = $derived(
    weigh(
      [...this.main, ...this.periodMain],
      this.into ?? session.primary?.code ?? "",
      impliedRates(this.raw)
    )
  );

  constructor(args: () => Args) {
    this.args = args;
    this.ledger = createQuery(() => ({
      ...ledgerQuery(this.anchor),
      enabled: !this.allTime,
    }));
    this.accounts = createQuery(() => lists.accounts("all"));
    this.source = createQuery(() => {
      const range = this.sourceRange;
      return {
        enabled: this.allTime || !this.inside,
        queryFn: () =>
          pages<TransactionGroup>(this.spec.source, {
            ...(range ?? {}),
            type: "default",
          }),
        queryKey: [
          "dimension",
          this.spec.source,
          range?.start ?? "all",
          range?.end ?? "all",
        ],
      };
    });
  }
}
