import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema.js";

export type Schemas = components["schemas"];

const XSRF_COOKIE = /(?:^|;\s*)XSRF-TOKEN=([^;]*)/;
const RETURN_KEY = "ffui.returnTo";
const LOOP_GUARD_MS = 10_000;
const PING_EVERY_MS = 15 * 60_000;
const PING_STALE_MS = 5 * 60_000;

export type SessionState = "ok" | "unauthenticated" | "mfa";

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    errors: Record<string, string[]> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export function xsrfToken(): string {
  const match = document.cookie.match(XSRF_COOKIE);
  return match ? decodeURIComponent(match[1]) : "";
}

export function apiHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-XSRF-TOKEN": xsrfToken(),
  };
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

let lastPing = 0;

export async function ping(): Promise<SessionState> {
  lastPing = Date.now();
  const res = await fetch("/json/intro/ffui", {
    credentials: "same-origin",
    headers: apiHeaders(false),
  });
  if (res.status === 401 || res.redirected) {
    return "unauthenticated";
  }
  const body = await res.json().catch(() => null);
  return Array.isArray(body) ? "ok" : "mfa";
}

export function leaveTo(state: Exclude<SessionState, "ok">) {
  const raw = sessionStorage.getItem(RETURN_KEY);
  const previous = raw ? (JSON.parse(raw) as { at: number }) : null;
  if (previous && Date.now() - previous.at < LOOP_GUARD_MS) {
    throw new ApiError(401, "Session expired");
  }
  const path = location.pathname + location.search + location.hash;
  sessionStorage.setItem(RETURN_KEY, JSON.stringify({ at: Date.now(), path }));
  location.assign(state === "mfa" ? "/profile" : "/login");
}

export function takeReturnPath(): string | null {
  const raw = sessionStorage.getItem(RETURN_KEY);
  if (!raw) {
    return null;
  }
  sessionStorage.removeItem(RETURN_KEY);
  const { path } = JSON.parse(raw) as { path: string };
  return path === location.pathname + location.search ? null : path;
}

export function keepAlive() {
  const refresh = () => {
    if (Date.now() - lastPing > PING_STALE_MS) {
      ping().catch(() => undefined);
    }
  };
  const timer = setInterval(() => ping().catch(() => undefined), PING_EVERY_MS);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  window.addEventListener("online", refresh);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("online", refresh);
  };
}

export async function logout() {
  await fetch("/logout", {
    credentials: "same-origin",
    headers: apiHeaders(false),
    method: "POST",
  });
  location.assign("/login");
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as {
    message?: string;
    errors?: Record<string, string[] | string>;
  } | null;
  const errors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(body?.errors ?? {})) {
    errors[key] = Array.isArray(value) ? value : [value];
  }
  return new ApiError(res.status, body?.message ?? res.statusText, errors);
}

function withHeaders(request: Request): Request {
  const json = !(request.body instanceof Blob) && request.method !== "GET";
  for (const [key, value] of Object.entries(apiHeaders(json))) {
    if (!request.headers.has(key) || key === "X-XSRF-TOKEN") {
      request.headers.set(key, value);
    }
  }
  return request;
}

async function recover(request: Request, response: Response) {
  if (response.status !== 401) {
    return response;
  }
  const state = await ping();
  if (state === "ok" && request.method === "GET") {
    const retry = await fetch(withHeaders(request));
    if (retry.status !== 401) {
      return retry;
    }
  }
  if (state !== "ok") {
    leaveTo(state);
  }
  return response;
}

const auth: Middleware = {
  onRequest: ({ request }) => withHeaders(request),
  onResponse: ({ request, response }) => recover(request, response),
};

export const client = createClient<paths>({
  baseUrl: "/api",
  credentials: "same-origin",
});
client.use(auth);

interface Result<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  const { data, response } = await promise;
  if (!response.ok) {
    throw await toError(response);
  }
  return data as T;
}

export type Query = Record<string, unknown>;

export function apiUrl(path: string, query: Query = {}): URL {
  const url = new URL(`/api${path}`, location.origin);
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null && item !== "") {
        url.searchParams.append(key, String(item));
      }
    }
  }
  return url;
}

export async function api<T>(
  path: string,
  {
    query,
    body,
    ...init
  }: Omit<RequestInit, "body"> & { query?: Query; body?: unknown } = {}
): Promise<T> {
  const json = !(body === undefined || body instanceof Blob);
  const request = withHeaders(
    new Request(apiUrl(path, query), {
      credentials: "same-origin",
      ...init,
      body: json ? JSON.stringify(body) : (body as BodyInit | undefined),
      headers: json ? { "Content-Type": "application/json" } : init.headers,
    })
  );
  const response = await recover(request.clone(), await fetch(request));
  if (!response.ok) {
    throw await toError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
