import { type Api, pool } from "./api.ts";
import {
  assets,
  bills,
  budgets,
  categories,
  currencies,
  expenses,
  liabilities,
  piggyBanks,
  plainTags,
  primaryCurrency,
  RENT,
  revenues,
  SALARY,
  SAVINGS,
  trips,
} from "./catalog.ts";
import {
  accountCurrency,
  buildLedger,
  type Calendar,
  createCalendar,
  createRng,
  type Entry,
  HISTORY_MONTHS,
  rate,
  tripTag,
} from "./ledger.ts";

const LIMIT_SEED = 7;
const BUDGET_ROUNDING = 100;
const MIN_LIMIT = 500;

type Ids = Record<string, string>;

interface Registry {
  accounts: Ids;
  bills: Ids;
  budgets: Ids;
  categories: Ids;
  journals: Ids;
  piggies: Ids;
}

const money = (value: number) => value.toFixed(2);

const sequential = async <T>(
  label: string,
  items: readonly T[],
  task: (item: T) => Promise<unknown>
) => {
  await pool(label, items, 1, task);
};

const setupCurrencies = async (api: Api) => {
  await sequential("currencies", currencies, (code) =>
    api.json("POST", `/currencies/${code}/enable`)
  );
  await api.json("POST", `/currencies/${primaryCurrency}/primary`);
};

const createExchangeRates = async (api: Api, calendar: Calendar) => {
  const points = Array.from({ length: HISTORY_MONTHS }, (_, month) => ({
    date: calendar.date(month, 1),
    month,
  }));
  points.push({ date: calendar.today, month: HISTORY_MONTHS - 1 });
  const rates = points.flatMap(({ date, month }) =>
    currencies
      .filter((code) => code !== primaryCurrency)
      .map((from) => ({
        date,
        from,
        rate: String(rate(from, month)),
        to: primaryCurrency,
      }))
  );
  await sequential("exchange rates", rates, (body) =>
    api.create("/exchange-rates", body)
  );
};

const createOrReuseAccount = async (
  api: Api,
  body: Record<string, unknown>
) => {
  try {
    return (await api.create("/accounts", body)).id;
  } catch (error) {
    const shared = body.type === "expense" || body.type === "revenue";
    if (!(shared && String(error).includes("already in use"))) {
      throw error;
    }
    const existing = await api.list(`/accounts?type=${body.type}`);
    const match = existing.find((item) => item.attributes.name === body.name);
    if (!match) {
      throw error;
    }
    console.log(`\n  reused ${body.type} account "${body.name}"`);
    return match.id;
  }
};

const createAccounts = async (api: Api, calendar: Calendar) => {
  const opening = calendar.opening();
  const payloads: [string, Record<string, unknown>][] = [
    ...assets.map((account): [string, Record<string, unknown>] => [
      account.key,
      {
        account_number: account.number,
        account_role: account.role,
        credit_card_type:
          account.role === "ccAsset" ? "monthlyFull" : undefined,
        currency_code: account.currency,
        monthly_payment_date:
          account.role === "ccAsset" ? calendar.date(0, 25) : undefined,
        name: account.name,
        notes: account.notes,
        opening_balance: account.opening ? money(account.opening) : undefined,
        opening_balance_date: account.opening ? opening : undefined,
        type: "asset",
        virtual_balance: account.creditLimit
          ? money(account.creditLimit)
          : undefined,
      },
    ]),
    ...liabilities.map((account): [string, Record<string, unknown>] => [
      account.key,
      {
        currency_code: account.currency,
        interest: String(account.interest),
        interest_period: "monthly",
        liability_direction: account.direction,
        liability_type: account.type,
        name: account.name,
        notes: account.notes,
        opening_balance: money(account.opening),
        opening_balance_date: opening,
        type: "liabilities",
      },
    ]),
    ...Object.entries(expenses).map(
      ([key, name]): [string, Record<string, unknown>] => [
        key,
        { name, type: "expense" },
      ]
    ),
    ...Object.entries(revenues).map(
      ([key, name]): [string, Record<string, unknown>] => [
        key,
        { name, type: "revenue" },
      ]
    ),
  ];
  const ids: Ids = {};
  await sequential("accounts", payloads, async ([key, body]) => {
    ids[key] = await createOrReuseAccount(api, body);
  });
  return ids;
};

const createNamed = async (
  api: Api,
  label: string,
  path: string,
  items: readonly Record<string, unknown>[],
  nameField: string
) => {
  const ids: Ids = {};
  await sequential(label, items, async (body) => {
    ids[String(body[nameField])] = (await api.create(path, body)).id;
  });
  return ids;
};

const createTags = (api: Api, calendar: Calendar) =>
  createNamed(
    api,
    "tags",
    "/tags",
    [
      ...plainTags,
      ...trips.map((trip) => ({
        date: calendar.date(trip.month, 14),
        description: trip.description,
        tag: tripTag(calendar, trip.key),
      })),
    ],
    "tag"
  );

const createBudgets = (api: Api) =>
  createNamed(
    api,
    "budgets",
    "/budgets",
    budgets.map((budget) =>
      budget.autoAmount
        ? {
            active: true,
            auto_budget_amount: money(budget.autoAmount),
            auto_budget_currency_code: primaryCurrency,
            auto_budget_period: "monthly",
            auto_budget_type: "rollover",
            name: budget.name,
          }
        : { active: true, name: budget.name }
    ),
    "name"
  );

const createBills = async (api: Api, calendar: Calendar) => {
  const ids: Ids = {};
  await sequential("bills", bills, async (bill) => {
    const yearly = bill.month !== undefined;
    const [min, max] = bill.amount;
    ids[bill.key] = (
      await api.create("/bills", {
        active: bill.stopAfter === undefined,
        amount_max: money(max),
        amount_min: money(min),
        currency_code: bill.currency,
        date: calendar.date(bill.month ?? 0, bill.day),
        name: bill.name,
        notes: bill.stopAfter === undefined ? undefined : "Cancelled.",
        object_group_title: bill.group,
        repeat_freq: yearly ? "yearly" : "monthly",
        skip: 0,
      })
    ).id;
  });
  return ids;
};

const createPiggyBanks = async (
  api: Api,
  calendar: Calendar,
  accounts: Ids
) => {
  const ids: Ids = {};
  await sequential("piggy banks", piggyBanks, async (piggy) => {
    ids[piggy.key] = (
      await api.create("/piggy-banks", {
        accounts: [
          {
            account_id: accounts[piggy.account],
            current_amount: money(piggy.current),
          },
        ],
        name: piggy.name,
        notes: piggy.notes,
        object_group_title: piggy.group,
        start_date: calendar.date(0, 1),
        target_amount: money(piggy.target),
        target_date: piggy.targetMonths
          ? calendar.date(HISTORY_MONTHS - 1 + piggy.targetMonths, 1)
          : undefined,
        transaction_currency_code: accountCurrency[piggy.account],
      })
    ).id;
  });
  return ids;
};

const entryCurrency = (entry: Entry) => {
  const [split] = entry.splits;
  const owner = entry.type === "deposit" ? split?.destination : split?.source;
  return accountCurrency[owner ?? ""] ?? primaryCurrency;
};

const transactionPayload = (entry: Entry, registry: Registry) => ({
  apply_rules: false,
  error_if_duplicate_hash: false,
  fire_webhooks: false,
  group_title: entry.title,
  transactions: entry.splits.map((split) => ({
    amount: money(split.amount),
    bill_id: split.bill ? registry.bills[split.bill] : undefined,
    book_date: split.bookDate,
    budget_id: split.budget ? registry.budgets[split.budget] : undefined,
    category_id: split.category
      ? registry.categories[split.category]
      : undefined,
    currency_code: entryCurrency(entry),
    date: entry.date,
    description: split.description,
    destination_id: registry.accounts[split.destination],
    external_url: split.externalUrl,
    foreign_amount: split.foreign ? money(split.foreign.amount) : undefined,
    foreign_currency_code: split.foreign?.currency,
    interest_date: split.interestDate,
    notes: split.notes,
    piggy_bank_id: split.piggy ? registry.piggies[split.piggy] : undefined,
    process_date: split.processDate,
    reconciled: split.reconciled,
    source_id: registry.accounts[split.source],
    tags: split.tags,
    type: entry.type,
  })),
});

const createTransactions = async (
  api: Api,
  entries: Entry[],
  registry: Registry
) => {
  await sequential("transactions", entries, async (entry) => {
    const group = await api.create(
      "/transactions",
      transactionPayload(entry, registry)
    );
    const [journal] = group.attributes.transactions as {
      transaction_journal_id: string;
    }[];
    if (entry.key && journal) {
      registry.journals[entry.key] = journal.transaction_journal_id;
    }
  });
};

const createBudgetLimits = async (
  api: Api,
  calendar: Calendar,
  entries: Entry[],
  ids: Ids
) => {
  const rng = createRng(LIMIT_SEED);
  const spent = new Map<string, number>();
  for (const entry of entries) {
    if (entryCurrency(entry) !== primaryCurrency) {
      continue;
    }
    for (const split of entry.splits) {
      if (split.budget) {
        const key = `${split.budget}:${entry.month}`;
        spent.set(key, (spent.get(key) ?? 0) + split.amount);
      }
    }
  }
  const current = HISTORY_MONTHS - 1;
  const limits = budgets.flatMap((budget) =>
    Array.from({ length: HISTORY_MONTHS }, (_, month) => month)
      .filter((month) => !(budget.autoAmount && month === current))
      .map((month) => {
        const projection =
          month === current
            ? calendar.daysIn(month) / calendar.lastDay(month)
            : 1;
        const base = (spent.get(`${budget.name}:${month}`) ?? 0) * projection;
        const amount = Math.max(
          MIN_LIMIT,
          Math.round((base * rng.amount(0.8, 1.3)) / BUDGET_ROUNDING) *
            BUDGET_ROUNDING
        );
        return { amount, budget: budget.name, month };
      })
  );
  await sequential("budget limits", limits, (limit) =>
    api.create(`/budgets/${ids[limit.budget]}/limits`, {
      amount: money(limit.amount),
      currency_code: primaryCurrency,
      end: calendar.end(limit.month),
      fire_webhooks: false,
      start: calendar.date(limit.month, 1),
    })
  );
};

const createLinks = (api: Api, journals: Ids) =>
  sequential(
    "transaction links",
    [
      ["Refund", "allegroPurchase", "allegroRefund", "Returned within 14 days"],
      ["Paid", "artemDinner", "payArtem", undefined],
      ["Paid", "lendIvan", "ivanPaid", "First instalment"],
      ["Reimbursement", "dock", "krakenInvoice", "Kraken paid for the dock"],
    ] as const,
    ([type, inward, outward, notes]) =>
      api.create("/transaction-links", {
        inward_id: journals[inward],
        link_type_name: type,
        notes,
        outward_id: journals[outward],
      })
  );

const PNG_PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const createAttachments = (api: Api, journals: Ids) =>
  sequential(
    "attachments",
    [
      {
        content: new TextEncoder().encode(
          "KAUFLAND\nGroceries .......... see split 1\nHousehold ......... see split 2\nPaid by card\n"
        ),
        filename: "kaufland-receipt.txt",
        journal: "receipt",
        title: "Receipt",
      },
      {
        content: new TextEncoder().encode(
          "INVOICE BL-001\nBrightline Studio\nSoftware development services\nNet 14 days\n"
        ),
        filename: "brightline-invoice.txt",
        journal: "brightlineInvoice",
        title: "Invoice",
      },
      {
        content: Uint8Array.from(atob(PNG_PIXEL), (char) => char.charCodeAt(0)),
        filename: "ikea-receipt.png",
        journal: "ikea",
        title: "IKEA receipt photo",
      },
    ],
    async (file) => {
      const attachment = await api.create("/attachments", {
        attachable_id: journals[file.journal],
        attachable_type: "TransactionJournal",
        filename: file.filename,
        title: file.title,
      });
      await api.upload(`/attachments/${attachment.id}/upload`, file.content);
    }
  );

const nextYearly = (calendar: Calendar, key: string) => {
  const bill = bills.find((item) => item.key === key);
  return calendar.date((bill?.month ?? 0) + HISTORY_MONTHS, bill?.day ?? 1);
};

interface RecurrenceSpec {
  active?: boolean;
  end: { repeat_until: string } | { nr_of_repetitions: number };
  first: string;
  repetition: { moment: string; type: "monthly" | "yearly" };
  title: string;
  transaction: Record<string, unknown>;
  type: "withdrawal" | "deposit" | "transfer";
}

const createRecurrences = (
  api: Api,
  calendar: Calendar,
  registry: Registry
) => {
  const next = HISTORY_MONTHS;
  const domainDate = nextYearly(calendar, "moosedev");
  const specs: RecurrenceSpec[] = [
    {
      end: { repeat_until: calendar.date(next + 12, 10) },
      first: calendar.date(next, 10),
      repetition: { moment: "10", type: "monthly" },
      title: "Salary — Northwind Labs",
      transaction: {
        amount: money(SALARY),
        currency_code: "USD",
        destination_id: registry.accounts.wise,
        source_id: registry.accounts.northwind,
      },
      type: "deposit",
    },
    {
      end: { repeat_until: calendar.date(next + 9, 1) },
      first: calendar.date(next, 1),
      repetition: { moment: "1", type: "monthly" },
      title: "Rent",
      transaction: {
        amount: money(RENT),
        category_id: registry.categories.Housing,
        currency_code: "PLN",
        destination_id: registry.accounts.landlord,
        source_id: registry.accounts.pko,
      },
      type: "withdrawal",
    },
    {
      end: { nr_of_repetitions: 5 },
      first: domainDate,
      repetition: { moment: domainDate, type: "yearly" },
      title: "moose.dev renewal",
      transaction: {
        amount: "14.99",
        currency_code: "USD",
        destination_id: registry.accounts.porkbun,
        source_id: registry.accounts.wise,
      },
      type: "withdrawal",
    },
    {
      active: false,
      end: { nr_of_repetitions: 12 },
      first: calendar.date(next, 11),
      repetition: { moment: "11", type: "monthly" },
      title: "Savings top-up",
      transaction: {
        amount: money(SAVINGS),
        currency_code: "UAH",
        destination_id: registry.accounts.savings,
        source_id: registry.accounts.mono,
      },
      type: "transfer",
    },
  ];
  return sequential("recurrences", specs, (spec) =>
    api.create("/recurrences", {
      active: spec.active ?? true,
      apply_rules: false,
      first_date: spec.first,
      repetitions: [{ ...spec.repetition, skip: 0, weekend: 1 }],
      title: spec.title,
      transactions: [{ ...spec.transaction, description: spec.title }],
      type: spec.type,
      ...spec.end,
    })
  );
};

const rule = (
  title: string,
  group: string,
  match: string,
  actions: [string, string][],
  active = true
) => ({
  actions: actions.map(([type, value]) => ({
    active: true,
    stop_processing: false,
    type,
    value,
  })),
  active,
  rule_group_id: group,
  stop_processing: false,
  strict: false,
  title,
  trigger: "store-journal",
  triggers: [
    {
      active: true,
      stop_processing: false,
      type: "description_contains",
      value: match,
    },
  ],
});

const createRules = async (api: Api) => {
  const auto = await api.create("/rule-groups", {
    active: true,
    description: "Categorise card payments by description",
    title: "Auto-categorise",
  });
  const legacy = await api.create("/rule-groups", {
    active: false,
    description: "Left over from the bank CSV import days",
    title: "Old import rules",
  });
  await sequential(
    "rules",
    [
      rule("Bolt rides are transport", auto.id, "Bolt", [
        ["set_category", "Transport"],
      ]),
      rule("Biedronka is groceries", auto.id, "Biedronka", [
        ["set_category", "Groceries"],
        ["set_budget", "Groceries"],
      ]),
      rule("Tag Brightline invoices", auto.id, "Brightline", [
        ["add_tag", "programming/client-a"],
      ]),
      rule(
        "Netflix to bill",
        legacy.id,
        "Netflix",
        [["link_to_bill", "Netflix Standard"]],
        false
      ),
    ],
    (body) => api.create("/rules", body)
  );
};

const createWebhook = async (api: Api) => {
  await api.json("PUT", "/configuration/configuration.allow_webhooks", {
    value: true,
  });
  await api.create("/webhooks", {
    active: false,
    deliveries: ["JSON"],
    responses: ["TRANSACTIONS"],
    title: "Stand webhook (inactive)",
    triggers: ["STORE_TRANSACTION"],
    url: "http://127.0.0.1:9/ffui-stand-hook",
  });
};

const setPreferences = (api: Api, accounts: Ids) =>
  sequential(
    "preferences",
    [
      ["viewRange", "1M"],
      ["listPageSize", 50],
      ["locale", "en_GB"],
      ["language", "en_US"],
      ["darkMode", "browser"],
      [
        "frontpageAccounts",
        assets
          .filter((account) => account.frontpage)
          .map((account) => Number(accounts[account.key])),
      ],
    ] as const,
    ([name, data]) => api.json("POST", "/preferences", { data, name })
  );

export const seed = async (api: Api, today: Date) => {
  const calendar = createCalendar(today);
  const entries = buildLedger(calendar);
  await setupCurrencies(api);
  await createExchangeRates(api, calendar);
  const registry: Registry = {
    accounts: await createAccounts(api, calendar),
    bills: {},
    budgets: {},
    categories: await createNamed(
      api,
      "categories",
      "/categories",
      categories.map((name) => ({ name })),
      "name"
    ),
    journals: {},
    piggies: {},
  };
  await createTags(api, calendar);
  registry.budgets = await createBudgets(api);
  registry.bills = await createBills(api, calendar);
  registry.piggies = await createPiggyBanks(api, calendar, registry.accounts);
  await createTransactions(api, entries, registry);
  await createBudgetLimits(api, calendar, entries, registry.budgets);
  await createLinks(api, registry.journals);
  await createAttachments(api, registry.journals);
  await createRecurrences(api, calendar, registry);
  await createRules(api);
  await createWebhook(api);
  await setPreferences(api, registry.accounts);
};
