const UNTIL_KEY = "ffui.reviewed-until";
const IDS_KEY = "ffui.reviewed-ids";
const FIRST_LOOK_MS = 2 * 86_400_000;

export interface Entry {
  at: string;
  id: string;
}

const time = (value: string) => Date.parse(value);

function read(key: string): string | null {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
}

class Reviewed {
  until = $state(read(UNTIL_KEY) ?? "");
  ids = $state.raw(new Set<string>(JSON.parse(read(IDS_KEY) ?? "[]")));

  constructor() {
    if (!this.until && typeof localStorage !== "undefined") {
      const first = new Date(Date.now() - FIRST_LOOK_MS).toISOString();
      this.save(first, this.ids);
    }
  }

  isNew(entry: Entry) {
    return time(entry.at) > time(this.until) && !this.ids.has(entry.id);
  }

  toggle(entry: Entry) {
    const ids = new Set(this.ids);
    if (this.isNew(entry)) {
      ids.add(entry.id);
    } else {
      ids.delete(entry.id);
    }
    this.save(this.until, ids);
  }

  all(entries: Entry[]) {
    const newest = Math.max(
      time(this.until),
      ...entries.map((e) => time(e.at))
    );
    this.save(new Date(newest).toISOString(), new Set());
  }

  compact(entries: Entry[]) {
    const after = entries
      .filter((e) => time(e.at) > time(this.until))
      .sort((a, b) => time(a.at) - time(b.at));
    const open = after.find((e) => !this.ids.has(e.id));
    const limit = open ? time(open.at) : Number.POSITIVE_INFINITY;
    const done = after.filter((e) => time(e.at) < limit);
    const ids = after
      .filter((e) => time(e.at) >= limit && this.ids.has(e.id))
      .map((e) => e.id);
    this.save(done.at(-1)?.at ?? this.until, new Set(ids));
  }

  private save(until: string, ids: Set<string>) {
    this.until = until;
    this.ids = ids;
    localStorage.setItem(UNTIL_KEY, until);
    localStorage.setItem(IDS_KEY, JSON.stringify([...ids]));
  }
}

export const reviewed = new Reviewed();
