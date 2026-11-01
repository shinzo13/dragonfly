import { apiHeaders } from "#lib/api/client.js";

export interface SyncSetting {
  key: string;
  label: string;
  type: "string" | "secret" | "number" | "bool" | "file";
  required: boolean;
  set?: boolean;
  value?: unknown;
}

export interface SourceResult {
  source: string;
  ok: boolean;
  created: number;
  settled: number;
  skipped: number;
  error: string | null;
  rejected?: boolean;
  retry_at?: string | null;
}

export interface SyncPlugin {
  id: string;
  name: string;
  kind: "source" | "matcher" | "enricher" | "hook";
  icon: string;
  cron: string | null;
  min_interval: number;
  blocked: string | null;
  last_run: string | null;
  last_ok: string | null;
  last_result: SourceResult | null;
  auth: { type: string; expires_at: string | null };
  settings: SyncSetting[];
}

export interface SyncQuestion {
  id: number;
  source: string;
  type: "category" | "receipts" | "receipt_items" | "stale_provisional" | "unexplained_gap";
  text: string;
  payload: Record<string, string>;
  created: string;
}

export interface SyncRun {
  id: number;
  started: string;
  finished: string | null;
  ok: number | null;
  report: { sources: SourceResult[]; created: number; questions: number } | null;
}

export class SyncError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/sync${path}`, {
    ...init,
    headers: apiHeaders(),
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new SyncError(response.status, body.error ?? response.statusText);
  }
  return body as T;
}

export const sync = {
  answer: (id: number, answer: Record<string, unknown>) => call(`/questions/${id}`, { body: JSON.stringify(answer), method: "POST" }),
  authFinish: (id: string, params: Record<string, string>) =>
    call<{ expires_at: string }>(`/plugins/${id}/auth/finish`, { body: JSON.stringify(params), method: "POST" }),
  authStart: (id: string, returnUrl: string) =>
    call<{ url: string }>(`/plugins/${id}/auth/start`, { body: JSON.stringify({ return_url: returnUrl }), method: "POST" }),
  plugins: () => call<{ plugins: SyncPlugin[]; errors: string[] }>("/plugins"),
  questions: () => call<SyncQuestion[]>("/questions"),
  run: (id?: string) => call<{ sources: SourceResult[] }>(id ? `/plugins/${id}/run` : "/run", { method: "POST" }),
  runs: (limit = 12) => call<SyncRun[]>(`/runs?limit=${limit}`),
  saveSettings: (id: string, values: Record<string, unknown>) =>
    call(`/plugins/${id}/settings`, { body: JSON.stringify(values), method: "PUT" }),
};

export const syncKeys = {
  plugins: ["sync", "plugins"],
  questions: ["sync", "questions"],
  runs: ["sync", "runs"],
};
