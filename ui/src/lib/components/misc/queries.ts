import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type { Currency, One } from "#lib/api/types.js";

interface Me {
  email: string;
  role?: string | null;
}

const FOREVER = Number.POSITIVE_INFINITY;

export const misc = {
  config: (key: string) => ({
    queryFn: () =>
      api<{ data: { value: unknown } }>(`/v1/configuration/${key}`).then(
        (body) => body.data.value
      ),
    queryKey: ["configuration", key],
    staleTime: FOREVER,
  }),
  currencies: () => ({
    queryFn: () => all<Currency>("/v1/currencies"),
    queryKey: ["currencies"],
  }),
  me: () => ({
    queryFn: () =>
      api<One<Me>>("/v1/about/user").then((body) => body.data.attributes),
    queryKey: ["about-user"],
    staleTime: FOREVER,
  }),
};

export const dateOnly = (value?: string | null) => value?.slice(0, 10);

export function sizeText(bytes: number | null | undefined): string {
  const value = bytes ?? 0;
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`;
}
