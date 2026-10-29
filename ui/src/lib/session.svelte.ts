import { setMode } from "mode-watcher";
import {
  api,
  keepAlive,
  leaveTo,
  ping,
  takeReturnPath,
} from "#lib/api/client.js";
import type {
  Currency,
  Item,
  Page,
  Preference,
  SystemInfo,
} from "#lib/api/types.js";
import type { ViewRange } from "#lib/dates.js";
import { configureFormat } from "#lib/format.js";

export const TESTED_VERSION = "6.7.9";

type About = SystemInfo;
interface User {
  data: { attributes: { email: string } };
}

function toLocale(locale: unknown, language: unknown): string {
  const raw = locale && locale !== "equal" ? locale : language;
  return typeof raw === "string" && raw ? raw.replace("_", "-") : "en-GB";
}

const VERSION_PREFIX = /^v/;
const VERSION_SPLIT = /[.-]/;

const versionParts = (value: string) =>
  value.replace(VERSION_PREFIX, "").split(VERSION_SPLIT).map(Number);

export function newer(a: string, b: string): boolean {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}

class Session {
  ready = $state(false);
  failed = $state("");
  version = $state("");
  apiVersion = $state("");
  email = $state("");
  prefs = $state<Record<string, unknown>>({});
  currencies = $state<Item<Currency>[]>([]);

  locale = $derived(toLocale(this.prefs.locale, this.prefs.language));
  viewRange = $derived((this.prefs.viewRange as ViewRange) ?? "1M");
  pageSize = $derived(Number(this.prefs.listPageSize) || 50);
  anonymous = $derived(this.prefs.anonymous === true);
  frontpageAccounts = $derived(
    ((this.prefs.frontpageAccounts ?? []) as (number | string)[]).map(String)
  );
  primary = $derived(
    this.currencies.find((c) => c.attributes.primary)?.attributes ??
      this.currencies[0]?.attributes
  );
  drift = $derived(
    this.apiVersion !== "" && newer(this.apiVersion, TESTED_VERSION)
  );

  async loadPreferences() {
    const page = await api<Page<Preference>>("/v1/preferences", {
      query: { limit: 500 },
    });
    const prefs: Record<string, unknown> = {};
    for (const item of page.data) {
      prefs[item.attributes.name] = item.attributes.data;
    }
    this.prefs = prefs;
    configureFormat(this.locale, this.anonymous);
  }

  async loadCurrencies() {
    const page = await api<Page<Currency>>("/v1/currencies", {
      query: { limit: 500 },
    });
    this.currencies = page.data;
  }

  async setPreference(name: string, data: unknown) {
    const exists = name in this.prefs;
    await api(exists ? `/v1/preferences/${name}` : "/v1/preferences", {
      body: exists ? { data } : { data, name },
      method: exists ? "PUT" : "POST",
    });
    this.prefs = { ...this.prefs, [name]: data };
    configureFormat(this.locale, this.anonymous);
  }

  applyTheme() {
    const theme = this.prefs.darkMode;
    if (theme === "light" || theme === "dark") {
      setMode(theme);
    } else if (theme === "browser") {
      setMode("system");
    }
  }

  async boot(): Promise<string | null> {
    const state = await ping();
    if (state !== "ok") {
      leaveTo(state);
      return null;
    }
    const [about, user] = await Promise.all([
      api<About>("/v1/about"),
      api<User>("/v1/about/user"),
      this.loadPreferences(),
      this.loadCurrencies(),
    ]);
    this.version = about.data?.version ?? "";
    this.apiVersion = about.data?.api_version ?? "";
    this.email = user.data.attributes.email;
    this.applyTheme();
    this.ready = true;
    keepAlive();
    return takeReturnPath();
  }
}

export const session = new Session();
