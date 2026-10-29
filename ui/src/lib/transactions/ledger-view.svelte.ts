import { untrack } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import {
  describe,
  type Filters,
  filterParams,
  GROUP_BY,
  isFiltered,
  readFilters,
  withFilters,
} from "./ledger.js";

const TYPING_MS = 300;
const MAX_PINS = 9;
const PINS_KEY = "ffui.ledger.pins";
const IGNORED_KEY = "ffui.ledger.notDuplicates";

export interface Pin {
  label: string;
  query: string;
}

const DEFAULT_PINS: Pin[] = [
  { label: "No budget", query: "budget=none" },
  { label: "No category", query: "category=none" },
  { label: "With notes", query: "notes=yes" },
];

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const pinQuery = (filters: Filters) =>
  filterParams({ ...filters, group: null }).toString();

export class LedgerView {
  text = $state("");
  pins = $state<Pin[]>(stored(PINS_KEY, DEFAULT_PINS));
  ignored = $state(new Set<string>(stored<string[]>(IGNORED_KEY, [])));
  private written = "";
  private timer: ReturnType<typeof setTimeout> | undefined;

  url = $derived(readFilters(page.url.searchParams));
  filters = $derived<Filters>({ ...this.url, text: this.text });
  pinned = $derived(
    this.pins.findIndex((pin) => pin.query === pinQuery(this.filters))
  );

  constructor() {
    this.text = this.url.text;
    this.written = this.text;
    $effect(() => {
      const incoming = this.url.text;
      untrack(() => {
        if (incoming !== this.written) {
          this.written = incoming;
          this.text = incoming;
        }
      });
    });
  }

  private go(filters: Filters) {
    this.written = filters.text;
    goto(withFilters(page.url, filters), { replace: true, reset: false });
  }

  set(next: Filters) {
    clearTimeout(this.timer);
    this.text = next.text;
    this.go(next);
  }

  type(value: string) {
    this.text = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.go({ ...this.url, text: value }),
      TYPING_MS
    );
  }

  clear() {
    this.set({ ...this.filters, dupes: false, facets: {}, text: "" });
  }

  cycleGroup() {
    const order = [null, ...GROUP_BY];
    const next = order[(order.indexOf(this.filters.group) + 1) % order.length];
    this.set({ ...this.filters, group: next });
  }

  apply(pin: Pin) {
    const active = pin.query === pinQuery(this.filters);
    const next = readFilters(new URLSearchParams(active ? "" : pin.query));
    this.set({ ...next, group: this.filters.group });
  }

  private savePins(pins: Pin[]) {
    this.pins = pins;
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  }

  togglePin(): string {
    if (this.pinned >= 0) {
      const { label } = this.pins[this.pinned];
      this.savePins(this.pins.filter((_, index) => index !== this.pinned));
      return `Unpinned ${label}`;
    }
    if (!isFiltered(this.filters)) {
      return "Filter first, then pin";
    }
    if (this.pins.length >= MAX_PINS) {
      return `Up to ${MAX_PINS} pins`;
    }
    const label = describe({ ...this.filters, group: null });
    this.savePins([...this.pins, { label, query: pinQuery(this.filters) }]);
    return `Pinned as ${this.pins.length}`;
  }

  unpin(pin: Pin) {
    this.savePins(this.pins.filter((item) => item.query !== pin.query));
  }

  ignore(id: string) {
    this.ignored = new Set([...this.ignored, id]);
    localStorage.setItem(IGNORED_KEY, JSON.stringify([...this.ignored]));
  }
}
