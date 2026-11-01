import { invalidate } from "#lib/api/lists.js";

export class Saver {
  busy = $state(false);
  error = $state("");

  async run<T>(work: () => Promise<T>): Promise<T | undefined> {
    this.busy = true;
    this.error = "";
    try {
      const result = await work();
      await invalidate();
      return result;
    } catch (e) {
      const errors = (e as { errors?: Record<string, string[]> }).errors;
      const first = errors && Object.values(errors)[0]?.[0];
      this.error = first ?? (e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      this.busy = false;
    }
  }

  fail(message: string) {
    this.error = message;
  }
}

export const currencies = (list: { attributes: { code: string; enabled?: boolean; name: string } }[]) =>
  list.filter((c) => c.attributes.enabled !== false).map((c) => c.attributes);

export const toAmount = (text: string) => text.replace(/[\s  ]/g, "").replace(",", ".");

export const validAmount = (text: string) => text.trim() !== "" && Number.isFinite(Number(toAmount(text))) && Number(toAmount(text)) > 0;
