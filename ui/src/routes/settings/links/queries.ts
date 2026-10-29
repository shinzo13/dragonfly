import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type { LinkType, One, TransactionLink } from "#lib/api/types.js";

export const linkQueries = {
  links: (name?: string) => ({
    queryFn: () =>
      all<TransactionLink>("/v1/transaction-links", name ? { name } : {}),
    queryKey: ["transaction-links", name ?? ""],
  }),
  one: (id: string) => ({
    queryFn: () => api<One<LinkType>>(`/v1/link-types/${id}`),
    queryKey: ["link-type", id],
  }),
  types: () => ({
    queryFn: () => all<LinkType>("/v1/link-types"),
    queryKey: ["link-types"],
  }),
};
