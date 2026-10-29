const base = Bun.env.FFUI_URL ?? "http://127.0.0.1:40869";
const tokenFile =
  Bun.env.FFUI_TOKEN_FILE ?? `${Bun.env.HOME}/.config/ffui/stand-v3.token`;
const token = (await Bun.file(tokenFile).text()).trim();

const month = new Date().toISOString().slice(0, 7);
const start = `${month}-01`;
const end = new Date().toISOString().slice(0, 10);
const range = `start=${start}&end=${end}`;

interface Check {
  keys: string[];
  path: string;
}

const checks: Check[] = [
  { keys: ["data.version", "data.api_version"], path: "/v1/about" },
  { keys: ["data.attributes.email"], path: "/v1/about/user" },
  { keys: ["data", "meta.pagination"], path: "/v1/preferences?limit=500" },
  { keys: ["data.0.attributes.code"], path: "/v1/currencies?limit=500" },
  {
    keys: ["data.0.attributes.current_balance"],
    path: `/v1/accounts?type=asset&${range}`,
  },
  {
    keys: ["data.0.attributes.transactions.0.amount"],
    path: `/v1/transactions?type=all&${range}`,
  },
  {
    keys: ["data", "meta.pagination"],
    path: "/v1/search/transactions?query=amount_more%3A0",
  },
  { keys: ["data"], path: `/v1/budgets?${range}` },
  { keys: ["data"], path: `/v1/budget-limits?${range}` },
  { keys: ["data"], path: `/v1/available-budgets?${range}` },
  { keys: ["data"], path: `/v1/categories?${range}` },
  { keys: ["data"], path: "/v1/tags" },
  { keys: ["data"], path: `/v1/bills?${range}` },
  { keys: ["data"], path: "/v1/piggy-banks" },
  { keys: ["data"], path: "/v1/object-groups" },
  { keys: ["data"], path: "/v1/link-types" },
  { keys: ["data"], path: "/v1/recurrences" },
  { keys: ["data"], path: "/v1/attachments" },
  { keys: ["data"], path: "/v1/user-groups" },
  { keys: [], path: `/v1/summary/basic?${range}` },
  {
    keys: ["0.entries"],
    path: `/v1/chart/account/overview?${range}&period=1D`,
  },
  { keys: [], path: `/v1/chart/budget/overview?${range}` },
  { keys: [], path: `/v1/chart/category/overview?${range}` },
  { keys: [], path: `/v1/insight/expense/expense?${range}` },
  { keys: [], path: `/v1/insight/income/revenue?${range}` },
  { keys: [], path: `/v1/insight/expense/category?${range}` },
  { keys: [], path: "/v1/autocomplete/accounts?query=&limit=5" },
  { keys: [], path: "/v1/autocomplete/categories?query=&limit=5" },
  { keys: [], path: "/v1/configuration/search.operators" },
];

function pick(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

async function run(check: Check): Promise<string | null> {
  const response = await fetch(`${base}/api${check.path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return `${response.status} ${check.path}`;
  }
  const body = (await response.json()) as unknown;
  const emptyData =
    Array.isArray(pick(body, "data")) && pick(body, "data.0") === undefined;
  const emptyRoot = Array.isArray(body) && body.length === 0;
  const keys = check.keys.filter(
    (key) =>
      !(
        (emptyData && key.startsWith("data.0")) ||
        (emptyRoot && key.startsWith("0"))
      )
  );
  const missing = keys.filter((key) => pick(body, key) === undefined);
  if (missing.length > 0) {
    return `shape ${check.path}: missing ${missing.join(", ")}`;
  }
  return null;
}

const results = await Promise.all(checks.map(run));
const failures = results.filter((result): result is string => result !== null);
const about = (await (
  await fetch(`${base}/api/v1/about`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  })
).json()) as { data: { version: string } };

console.log(
  `Firefly ${about.data.version} at ${base}: ${checks.length - failures.length}/${checks.length} ok`
);
for (const failure of failures) {
  console.log(`FAIL ${failure}`);
}
process.exit(failures.length > 0 ? 1 : 0);
