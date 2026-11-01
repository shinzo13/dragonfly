import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type { One, UserGroup } from "#lib/api/types.js";

export interface Member {
  roles?: string[];
  user_email: string;
  user_id: string;
  you?: boolean;
}

export type Group = UserGroup & {
  members?: Member[];
  primary_currency_name?: string;
};

const ROLES: Record<string, string> = {
  full: "Full access",
  mng_budgets: "Manage budgets",
  mng_currencies: "Manage currencies",
  mng_meta: "Manage classification and meta-data",
  mng_piggies: "Manage piggy banks",
  mng_recurring: "Manage recurring transactions",
  mng_rules: "Manage rules",
  mng_subscriptions: "Manage subscriptions",
  mng_trx: "Manage transactions",
  mng_webhooks: "Manage webhooks",
  owner: "Owner",
  ro: "Read-only",
  view_reports: "View reports",
};

export const roleText = (roles: string[] = []) =>
  roles.map((role) => ROLES[role] ?? role).join(", ");

export const groupQueries = {
  all: () => ({
    queryFn: () => all<Group>("/v1/user-groups"),
    queryKey: ["user-groups"],
  }),
  one: (id: string) => ({
    queryFn: () => api<One<Group>>(`/v1/user-groups/${id}`),
    queryKey: ["user-group", id],
  }),
};
