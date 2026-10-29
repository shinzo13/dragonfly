import { parseArgs } from "node:util";
import { type Api, createApi } from "./api.ts";
import { createCalendar, HISTORY_MONTHS } from "./ledger.ts";
import { seed } from "./seed.ts";
import { wipe } from "./wipe.ts";

const MS_PER_SECOND = 1000;

const usage =
  "usage: bun scripts/seed/index.ts --base <url> --token-file <path> [--wipe]";

const summarize = async (api: Api) => {
  const calendar = createCalendar(new Date());
  const range = `start=${calendar.opening()}&end=${calendar.end(HISTORY_MONTHS)}`;
  const rows = [
    ["asset accounts", "/accounts?type=asset"],
    ["liabilities", "/accounts?type=liabilities"],
    ["expense accounts", "/accounts?type=expense"],
    ["revenue accounts", "/accounts?type=revenue"],
    ["withdrawals", `/transactions?type=withdrawal&${range}`],
    ["deposits", `/transactions?type=deposit&${range}`],
    ["transfers", `/transactions?type=transfer&${range}`],
    ["categories", "/categories"],
    ["budgets", "/budgets"],
    ["budget limits", `/budget-limits?${range}`],
    ["available budgets", "/available-budgets"],
    ["bills", "/bills"],
    ["piggy banks", "/piggy-banks"],
    ["object groups", "/object-groups"],
    ["tags", "/tags"],
    ["rule groups", "/rule-groups"],
    ["rules", "/rules"],
    ["recurrences", "/recurrences"],
    ["webhooks", "/webhooks"],
    ["attachments", "/attachments"],
    ["transaction links", "/transaction-links"],
    ["exchange rates", "/exchange-rates"],
  ] as const;
  const totals = await Promise.all(rows.map(([, path]) => api.total(path)));
  console.log("summary:");
  for (const [index, [label]] of rows.entries()) {
    console.log(`  ${label.padEnd(18)} ${totals[index]}`);
  }
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      "token-file": { type: "string" },
      wipe: { default: false, type: "boolean" },
    },
  });
  const tokenFile = values["token-file"];
  if (!(values.base && tokenFile)) {
    throw new Error(usage);
  }
  const token = (await Bun.file(tokenFile).text()).trim();
  const api = createApi(values.base, token);
  const about = await api.json<{ data: { version: string } }>("GET", "/about");
  console.log(`Firefly III ${about.data.version} at ${values.base}`);
  const started = performance.now();
  console.log("wipe:");
  await wipe(api);
  if (!values.wipe) {
    console.log("seed:");
    await seed(api, new Date());
    await summarize(api);
  }
  const seconds = (performance.now() - started) / MS_PER_SECOND;
  console.log(`done in ${seconds.toFixed(1)}s`);
};

await main();
