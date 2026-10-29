import { api } from "#lib/api/client.js";
import { all, queryClient } from "#lib/api/lists.js";
import type { ExchangeRate, Page, TransactionGroup } from "#lib/api/types.js";
import { formatMoney, type Money, toNumber } from "#lib/format.js";
import { session } from "#lib/session.svelte.js";

const KEY = "ffui.display";
const OWN_SAMPLE = 200;
const HOUR_MS = 3_600_000;

type Graph = Map<string, Map<string, number>>;

export interface Total {
  amount: number;
  code: string;
  converted: boolean;
  decimals: number;
  symbol: string;
}

function link(graph: Graph, from: string, to: string, rate: number) {
  if (!(rate > 0 && Number.isFinite(rate)) || from === to) {
    return;
  }
  const row = graph.get(from) ?? new Map<string, number>();
  if (!row.has(to)) {
    row.set(to, rate);
  }
  graph.set(from, row);
}

function listed(rates: { attributes: ExchangeRate }[], graph: Graph) {
  const latest = new Map<string, { date: string; rate: number }>();
  for (const { attributes: r } of rates) {
    const from = r.from_currency_code;
    const to = r.to_currency_code;
    const rate = toNumber(r.rate);
    const date = r.date ?? "";
    const key = `${from}>${to}`;
    if (from && to && rate && date >= (latest.get(key)?.date ?? "")) {
      latest.set(key, { date, rate });
    }
  }
  for (const [key, { rate }] of latest) {
    const [from, to] = key.split(">");
    link(graph, from, to, rate);
    link(graph, to, from, 1 / rate);
  }
}

function implied(groups: { attributes: TransactionGroup }[], graph: Graph) {
  const sums = new Map<string, [number, number]>();
  for (const split of groups.flatMap((g) => g.attributes.transactions)) {
    const from = split.currency_code;
    const to = split.foreign_currency_code;
    const x = Math.abs(toNumber(split.amount));
    const y = Math.abs(toNumber(split.foreign_amount));
    if (from && to && from !== to && x > 0 && y > 0) {
      const pair = sums.get(`${from}>${to}`) ?? [0, 0];
      sums.set(`${from}>${to}`, [pair[0] + x, pair[1] + y]);
    }
  }
  for (const [key, [x, y]] of sums) {
    const [from, to] = key.split(">");
    link(graph, from, to, y / x);
    link(graph, to, from, x / y);
  }
}

async function loadGraph(): Promise<Graph> {
  const [rates, own] = await Promise.all([
    all<ExchangeRate>("/v1/exchange-rates").catch(() => []),
    api<Page<TransactionGroup>>("/v1/search/transactions", {
      query: { limit: OWN_SAMPLE, query: "has_foreign_amount:true" },
    }).catch(() => ({ data: [] })),
  ]);
  const graph: Graph = new Map();
  listed(rates, graph);
  implied(own.data, graph);
  return graph;
}

function rateIn(graph: Graph, from: string, to: string): number | null {
  if (from === to) {
    return 1;
  }
  const rates = new Map([[from, 1]]);
  const queue = [from];
  for (const code of queue) {
    const base = rates.get(code) ?? 1;
    for (const [next, rate] of graph.get(code) ?? []) {
      if (!rates.has(next)) {
        rates.set(next, base * rate);
        queue.push(next);
      }
    }
    if (rates.has(to)) {
      return rates.get(to) ?? null;
    }
  }
  return null;
}

function read(): { code: string | null; on: boolean } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "") ?? {};
  } catch {
    return { code: null, on: false };
  }
}

class Display {
  on = $state(false);
  chosen = $state<string | null>(null);
  graph = $state.raw<Graph | null>(null);

  constructor() {
    if (typeof localStorage !== "undefined") {
      const saved = read();
      this.on = saved.on === true;
      this.chosen = saved.code ?? null;
    }
  }

  get code(): string {
    return this.chosen ?? session.primary?.code ?? "";
  }

  get target() {
    const { code } = this;
    const found = session.currencies.find((c) => c.attributes.code === code);
    return {
      code,
      decimals: found?.attributes.decimal_places ?? 2,
      symbol: found?.attributes.symbol ?? code,
    };
  }

  get active(): boolean {
    return this.on && this.graph !== null && this.code !== "";
  }

  get options() {
    return session.currencies
      .filter((c) => c.attributes.enabled)
      .map((c) => c.attributes);
  }

  private save() {
    localStorage.setItem(
      KEY,
      JSON.stringify({ code: this.chosen, on: this.on })
    );
  }

  async load() {
    if (this.graph) {
      return;
    }
    this.graph = await queryClient.fetchQuery({
      queryFn: loadGraph,
      queryKey: ["display-rates"],
      staleTime: HOUR_MS,
    });
  }

  show(code: string | null) {
    if (code === null) {
      this.on = false;
    } else {
      this.chosen = code;
      this.on = true;
      this.load().catch(() => undefined);
    }
    this.save();
  }

  toggle() {
    this.show(this.on ? null : this.code);
  }

  rate(from: string | null | undefined): number | null {
    if (!(this.active && this.graph && from)) {
      return null;
    }
    return rateIn(this.graph, from, this.code);
  }

  convert(amount: number, from: string | null | undefined): number | null {
    const rate = this.rate(from);
    return rate === null ? null : amount * rate;
  }

  total(parts: Money[]): Total | null {
    if (!this.active || parts.length === 0) {
      return null;
    }
    let amount = 0;
    let converted = false;
    for (const part of parts) {
      const value = this.convert(toNumber(part.amount), part.code);
      if (value === null) {
        return null;
      }
      amount += value;
      converted ||= part.code !== this.code;
    }
    return { ...this.target, amount, converted };
  }

  text(parts: Money[], signed = false, separator = " + "): string {
    const sum = this.total(parts);
    if (sum) {
      return `${sum.converted ? "≈" : ""}${formatMoney(sum, signed)}`;
    }
    return parts.map((part) => formatMoney(part, signed)).join(separator);
  }
}

export const display = new Display();
