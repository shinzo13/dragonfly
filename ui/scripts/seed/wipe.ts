import { type Api, pool } from "./api.ts";

const DELETE_CONCURRENCY = 1;

const destroyable = [
  "accounts",
  "revenue_accounts",
  "transactions",
  "budgets",
  "bills",
  "piggy_banks",
  "rules",
  "recurring",
  "categories",
  "tags",
  "object_groups",
];

const deleteAll = async (api: Api, label: string, path: string) => {
  const items = await api.list(path);
  await pool(label, items, DELETE_CONCURRENCY, (item) =>
    api.json("DELETE", `${path}/${item.id}`)
  );
};

export const wipe = async (api: Api) => {
  await api.json("PUT", "/configuration/configuration.allow_webhooks", {
    value: true,
  });
  await deleteAll(api, "webhooks", "/webhooks");
  await deleteAll(api, "attachments", "/attachments");
  await deleteAll(api, "transaction links", "/transaction-links");
  await deleteAll(api, "exchange rates", "/exchange-rates");
  await pool("destroy", destroyable, 1, (objects) =>
    api.json("DELETE", `/data/destroy?objects=${objects}`)
  );
  await api.json("DELETE", "/data/purge");
};
