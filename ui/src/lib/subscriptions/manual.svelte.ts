import { errorText } from "#lib/components/misc/action.svelte.js";
import { session } from "#lib/session.svelte.js";

const PREF = "ffui_bill_cards";
const LEGACY = "ffui.bill-card.";

type Choices = Record<string, string>;

function stored(): Choices {
  const data = session.prefs[PREF];
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Choices)
    : {};
}

function legacyKeys(): string[] {
  return Array.from(
    { length: localStorage.length },
    (_, i) => localStorage.key(i) ?? ""
  ).filter((key) => key.startsWith(LEGACY));
}

class ManualCards {
  pending = $state.raw<Choices | null>(null);
  picking = $state<{ at: string; ids: string[] } | null>(null);
  failure = $state("");
  ids = $derived(this.pending ?? stored());

  get(billId: string): string | null {
    return this.ids[billId] || null;
  }

  async set(billIds: string[], cardId: string | null) {
    const changes = Object.fromEntries(billIds.map((id) => [id, cardId ?? ""]));
    this.picking = null;
    await this.save({ ...this.ids, ...changes });
  }

  async migrate() {
    const keys = legacyKeys();
    if (keys.length === 0) {
      return;
    }
    const old = Object.fromEntries(
      keys.map((key) => [
        key.slice(LEGACY.length),
        localStorage.getItem(key) ?? "",
      ])
    );
    if (await this.save({ ...old, ...this.ids })) {
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    }
  }

  private async save(choices: Choices): Promise<boolean> {
    const next = Object.fromEntries(
      Object.entries(choices).filter(([, id]) => id)
    );
    this.pending = next;
    this.failure = "";
    try {
      await session.setPreference(
        PREF,
        Object.keys(next).length > 0 ? next : false
      );
      return true;
    } catch (e) {
      this.failure = errorText(e);
      return false;
    } finally {
      if (this.pending === next) {
        this.pending = null;
      }
    }
  }
}

export const manualCards = new ManualCards();
