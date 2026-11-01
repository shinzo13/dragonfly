import { session } from "#lib/session.svelte.js";

const PREF = "ffui_hidden_accounts";

class HiddenAccounts {
  private local = $state.raw<string[] | null>(null);
  private saving = Promise.resolve();
  private ids = $derived(this.local ?? ((session.prefs[PREF] as { ids?: string[] } | undefined)?.ids ?? []));

  has(id: string): boolean {
    return this.ids.includes(id);
  }

  toggle(id: string) {
    const next = this.has(id) ? this.ids.filter((x) => x !== id) : [...this.ids, id];
    this.local = next;
    this.saving = this.saving
      .then(() => session.setPreference(PREF, { ids: next }))
      .catch(() => {
        this.local = null;
      });
  }
}

export const hidden = new HiddenAccounts();
