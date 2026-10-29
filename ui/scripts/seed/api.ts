export interface Resource {
  attributes: Record<string, unknown>;
  id: string;
}

interface ListResponse {
  data: Resource[];
  meta: { pagination: { total: number; total_pages: number } };
}

const PAGE_LIMIT = 500;
const TRAILING_SLASHES = /\/+$/;
const BODY_PREVIEW = 1500;

const preview = (body: unknown) =>
  typeof body === "string" ? body.slice(0, BODY_PREVIEW) : "";

export const createApi = (base: string, token: string) => {
  const root = `${base.replace(TRAILING_SLASHES, "")}/api/v1`;

  const send = async <T>(
    method: string,
    path: string,
    body?: string | Uint8Array<ArrayBuffer>,
    contentType = "application/json"
  ): Promise<T> => {
    const response = await fetch(`${root}${path}`, {
      body,
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      method,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `${method} ${path} -> ${response.status}\n${text.slice(0, BODY_PREVIEW)}\nrequest: ${preview(body)}`
      );
    }
    return (text ? JSON.parse(text) : undefined) as T;
  };

  const json = <T>(method: string, path: string, body?: unknown) =>
    send<T>(
      method,
      path,
      body === undefined ? undefined : JSON.stringify(body)
    );

  const create = async (path: string, body: unknown) =>
    (await json<{ data: Resource }>("POST", path, body)).data;

  const list = async (path: string, page = 1): Promise<Resource[]> => {
    const glue = path.includes("?") ? "&" : "?";
    const response = await json<ListResponse>(
      "GET",
      `${path}${glue}limit=${PAGE_LIMIT}&page=${page}`
    );
    if (page >= response.meta.pagination.total_pages) {
      return response.data;
    }
    return [...response.data, ...(await list(path, page + 1))];
  };

  const total = async (path: string) => {
    const glue = path.includes("?") ? "&" : "?";
    const response = await json<ListResponse>("GET", `${path}${glue}limit=1`);
    return response.meta.pagination.total;
  };

  const upload = (path: string, body: Uint8Array<ArrayBuffer>) =>
    send<undefined>("POST", path, body, "application/octet-stream");

  return { create, json, list, total, upload };
};

export type Api = ReturnType<typeof createApi>;

const PROGRESS_STEP = 25;
const MS_PER_SECOND = 1000;

export const pool = async <T, R>(
  label: string,
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> => {
  const started = performance.now();
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const report = () => {
    const step = process.stdout.isTTY ? PROGRESS_STEP : items.length;
    if (done % step === 0 || done === items.length) {
      process.stdout.write(`\r  ${label} ${done}/${items.length}`);
    }
  };
  const worker = async (): Promise<void> => {
    if (cursor >= items.length) {
      return;
    }
    const index = cursor;
    cursor += 1;
    results[index] = await task(items[index] as T);
    done += 1;
    report();
    await worker();
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  if (items.length > 0) {
    const seconds = (performance.now() - started) / MS_PER_SECOND;
    process.stdout.write(` (${seconds.toFixed(1)}s)\n`);
  }
  return results;
};
