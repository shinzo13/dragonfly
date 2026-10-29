import { addDays, periodOf, today } from "#lib/dates.js";
import { formatDate } from "#lib/format.js";
import { goto } from "$app/navigation";

const KEY = "ffui.searches";
const SEEN_KEY = "ffui.searches.seen";
const FIRST_LOOK_DAYS = 7;

export interface SavedSearch {
  label: string;
  pinned: boolean;
  query: string;
  since?: boolean;
}

function load(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

const seen = () =>
  localStorage.getItem(SEEN_KEY) ?? addDays(today(), -FIRST_LOOK_DAYS);

class Searches {
  pinned = $state<string[]>(typeof localStorage === "undefined" ? [] : load());

  has(query: string) {
    return this.pinned.includes(query);
  }

  toggle(query: string): boolean {
    const pin = !this.has(query);
    this.pinned = pin
      ? [...this.pinned, query]
      : this.pinned.filter((item) => item !== query);
    localStorage.setItem(KEY, JSON.stringify(this.pinned));
    return pin;
  }

  list(): SavedSearch[] {
    const month = periodOf(today(), "1M");
    const range = `date_after:${month.start} date_before:${month.end}`;
    const builtins = [
      {
        label: `Since I last looked, ${formatDate(seen(), "short")}`,
        query: `created_at_after:${seen()}`,
        since: true,
      },
      {
        label: "No budget this month",
        query: `type:withdrawal has_no_budget:true ${range}`,
      },
      {
        label: "No category this month",
        query: `has_no_category:true ${range}`,
      },
      { label: "Has notes", query: "has_notes:true" },
    ];
    return [
      ...builtins.map((item) => ({ ...item, pinned: false })),
      ...this.pinned.map((query) => ({ label: query, pinned: true, query })),
    ];
  }

  open(saved: SavedSearch) {
    if (saved.since) {
      localStorage.setItem(SEEN_KEY, today());
    }
    return goto(`/search?search=${encodeURIComponent(saved.query)}`);
  }
}

export const searches = new Searches();
