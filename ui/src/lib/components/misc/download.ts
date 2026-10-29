import { ApiError, apiHeaders, apiUrl, type Query } from "#lib/api/client.js";

const FILENAME = /filename="?([^";]+)"?/;
const REVOKE_MS = 1000;

export async function download(
  path: string,
  query: Query,
  fallback: string
): Promise<number> {
  const response = await fetch(apiUrl(path, query), {
    credentials: "same-origin",
    headers: apiHeaders(false),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiError(response.status, body?.message ?? response.statusText);
  }
  const blob = await response.blob();
  const name =
    response.headers.get("Content-Disposition")?.match(FILENAME)?.[1] ??
    fallback;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_MS);
  return blob.size;
}
