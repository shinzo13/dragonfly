import { session } from "#lib/session.svelte.js";

export type LookKind = "account" | "category" | "tag" | "budget" | "bill" | "piggy";

export interface Look {
  color: string;
  icon: string;
}

interface Stored {
  looks: Record<string, Partial<Look>>;
  svgs: Record<string, string>;
}

const PREF = "ffui_look";
const RULES_PREF = "ffui_look_rules";

export const PALETTE = [
  "#3B5BFD",
  "#2870ED",
  "#0E94D6",
  "#0080C6",
  "#0D9488",
  "#16A34A",
  "#1A8A5A",
  "#65A30D",
  "#CA9A04",
  "#EA6A0C",
  "#E5484D",
  "#E13D8B",
  "#A855F7",
  "#7C5CFF",
  "#64748B",
  "#232326",
];

type Rule = [RegExp, string, string];

const RULES: Rule[] = [
  [/rent/, "house", "#7C5CFF"],
  [/dairy|cheese/, "milk", "#3B82F6"],
  [/meat/, "beef", "#E5484D"],
  [/alcohol|beer/, "wine", "#8B5CF6"],
  [/vegetab/, "carrot", "#22C55E"],
  [/fruit/, "apple", "#65A30D"],
  [/bakery|bread/, "croissant", "#D97706"],
  [/dessert|sweet/, "cake-slice", "#EC4899"],
  [/snack/, "cookie", "#CA9A04"],
  [/drink|juice/, "cup-soda", "#0E94D6"],
  [/spice|sauce/, "soup", "#EA6A0C"],
  [/pantry|grain/, "wheat", "#A16207"],
  [/ready|meal/, "utensils", "#F97316"],
  [/lunch/, "sandwich", "#CA8A04"],
  [/grocer/, "shopping-basket", "#16A34A"],
  [/^food$/, "utensils", "#16A34A"],
  [/cafe|café|restaurant|delivery|coffee/, "coffee", "#EA6A0C"],
  [/subscr|phone|internet/, "wifi", "#0E94D6"],
  [/transport|taxi|bus/, "tram-front", "#CA9A04"],
  [/online|aliexpress|amazon/, "package", "#A855F7"],
  [/cloth|beauty/, "sparkles", "#E13D8B"],
  [/health|pharm|doctor/, "heart-pulse", "#E5484D"],
  [/sport|gym/, "dumbbell", "#0D9488"],
  [/cash/, "banknote", "#1A8A5A"],
  [/entertain|cinema|game/, "ticket", "#E5484D"],
  [/transfer/, "arrow-left-right", "#64748B"],
  [/tax|government/, "landmark", "#475569"],
  [/crypto|ton|bitcoin|btc|usdt/, "gem", "#0080C6"],
  [/work|salary|job/, "briefcase", "#0F8A52"],
  [/purchase|shopping|shop/, "shopping-bag", "#A855F7"],
  [/travel|trip|hotel/, "plane", "#0E94D6"],
  [/education|course|book/, "graduation-cap", "#7C5CFF"],
  [/gift/, "gift", "#E13D8B"],
  [/cat|pet/, "cat", "#EA6A0C"],
  [/saving|set aside/, "piggy-bank", "#1A8A5A"],
  [/claude|openai|chatgpt|ai\b/, "sparkle", "#D97757"],
  [/other|misc/, "shapes", "#8B95A5"],
];

const BRANDS: Rule[] = [
  [/erste/, "landmark", "#2870ED"],
  [/mono/, "cat", "#232326"],
  [/paypal/, "wallet", "#003087"],
  [/revolut/, "credit-card", "#191C1F"],
  [/privat/, "landmark", "#4C9A2A"],
  [/pko/, "landmark", "#0B2D69"],
  [/mbank/, "landmark", "#C8102E"],
  [/santander/, "landmark", "#EC0000"],
  [/wise/, "globe", "#163300"],
  [/tonkeeper|ton\b|telegram wallet/, "gem", "#0080C6"],
  [/cryptobot|crypto bot/, "bot", "#1A8A5A"],
  [/binance|bybit|okx/, "bitcoin", "#CA9A04"],
  [/cash/, "banknote", "#1A8A5A"],
];

function hashColor(text: string): string {
  let h = 0;
  for (const char of text) {
    h = (h * 31 + char.charCodeAt(0)) | 0;
  }
  return PALETTE[Math.abs(h) % (PALETTE.length - 2)];
}

function guess(kind: LookKind, name: string, role: string | undefined, rules: Rule[], brands: Rule[]): Look {
  const text = name.toLowerCase();
  if (kind === "account") {
    for (const [re, icon, color] of brands) {
      if (re.test(text)) {
        return { color, icon };
      }
    }
    if (role === "savingAsset") {
      return { color: "#1A8A5A", icon: "piggy-bank" };
    }
    if (role === "ccAsset") {
      return { color: hashColor(text), icon: "credit-card" };
    }
    if (role === "cashWalletAsset") {
      return { color: "#1A8A5A", icon: "banknote" };
    }
    return { color: hashColor(text), icon: "landmark" };
  }
  for (const [re, icon, color] of rules) {
    if (re.test(text)) {
      return { color, icon };
    }
  }
  const fallback: Record<LookKind, string> = {
    account: "landmark",
    bill: "repeat",
    budget: "gauge",
    category: "shapes",
    piggy: "piggy-bank",
    tag: "tag",
  };
  return { color: hashColor(text), icon: fallback[kind] };
}

function compile(stored: [string, string, string][] | undefined, fallback: Rule[]): Rule[] {
  return stored?.map(([source, icon, color]) => [new RegExp(source), icon, color]) ?? fallback;
}

const SVG_TAG = /<svg[\s\S]*<\/svg>/i;

class LookStore {
  private stored = $derived((session.prefs[PREF] ?? {}) as Partial<Stored>);
  looks = $derived(this.stored.looks ?? {});
  svgs = $derived(this.stored.svgs ?? {});
  private custom = $derived((session.prefs[RULES_PREF] ?? {}) as { brands?: [string, string, string][]; rules?: [string, string, string][] });
  private rules = $derived(compile(this.custom.rules, RULES));
  private brands = $derived(compile(this.custom.brands, BRANDS));

  of(kind: LookKind, id: string | null | undefined, name = "", role?: string): Look {
    const base = guess(kind, name, role, this.rules, this.brands);
    const custom = id ? this.looks[`${kind}:${id}`] : undefined;
    return { color: custom?.color ?? base.color, icon: custom?.icon ?? base.icon };
  }

  svgUrl(icon: string): string | null {
    const svg = this.svgs[icon.slice(4)];
    return svg ? `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` : null;
  }

  private save(next: Stored) {
    return session.setPreference(PREF, next);
  }

  set(kind: LookKind, id: string, change: Partial<Look>) {
    const key = `${kind}:${id}`;
    return this.save({
      looks: { ...this.looks, [key]: { ...this.looks[key], ...change } },
      svgs: this.svgs,
    });
  }

  reset(kind: LookKind, id: string) {
    const looks = { ...this.looks };
    delete looks[`${kind}:${id}`];
    return this.save({ looks, svgs: this.svgs });
  }

  async upload(file: File): Promise<string> {
    const text = await file.text();
    const svg = text.match(SVG_TAG)?.[0];
    if (!svg) {
      throw new Error("That file has no <svg> inside");
    }
    const id = `${Date.now().toString(36)}`;
    await this.save({ looks: this.looks, svgs: { ...this.svgs, [id]: svg } });
    return `svg:${id}`;
  }

  async removeSvg(icon: string) {
    const svgs = { ...this.svgs };
    delete svgs[icon.slice(4)];
    const looks: Record<string, Partial<Look>> = {};
    for (const [key, value] of Object.entries(this.looks)) {
      looks[key] = value.icon === icon ? { ...value, icon: undefined } : value;
    }
    await this.save({ looks, svgs });
  }
}

export const look = new LookStore();
