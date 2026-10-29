import {
  assets,
  baseRates,
  bills,
  type Code,
  liabilities,
  primaryCurrency,
  RENT,
  SALARY,
  SAVINGS,
  trips,
} from "./catalog.ts";
import {
  billNotes,
  type Habit,
  habits,
  type Kind,
  type Plan,
  plans,
  type SharedDinner,
  sharedDinners,
  transferNotes,
} from "./plan.ts";

export const HISTORY_MONTHS = 12;
const CURRENT = HISTORY_MONTHS - 1;
const SEED = 20_261_016;
const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;
const CARD_MARGIN = 1.015;
const BUY_SPREAD = 1.012;
const SELL_SPREAD = 0.99;
const PAID_THIS_MONTH = 0.6;
const LATEST_RANDOM_DAY = 27;

export interface Split {
  amount: number;
  bill?: string;
  bookDate?: string;
  budget?: string;
  category?: string;
  description: string;
  destination: string;
  externalUrl?: string;
  foreign?: { amount: number; currency: Code };
  interestDate?: string;
  notes?: string;
  piggy?: string;
  processDate?: string;
  reconciled?: boolean;
  source: string;
  tags?: string[];
}

export interface Entry {
  date: string;
  key?: string;
  month: number;
  splits: Split[];
  title?: string;
  type: Kind;
}

type Extra = Omit<Split, "amount" | "destination" | "source"> & {
  key?: string;
};

export const accountCurrency: Record<string, Code> = Object.fromEntries(
  [...assets, ...liabilities].map((account) => [account.key, account.currency])
);

export const createRng = (seed: number) => {
  let state = seed % MODULUS || 1;
  const next = () => {
    state = (state * MULTIPLIER) % MODULUS;
    return (state - 1) / (MODULUS - 1);
  };
  const int = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1));
  const amount = (min: number, max: number, step = 0.01) =>
    Math.round((min + next() * (max - min)) / step) * step;
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(next() * items.length)] as T;
  const chance = (probability: number) => next() < probability;
  const weighted = <T>(items: readonly (readonly [T, number])[]) => {
    const total = items.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = next() * total;
    for (const [item, weight] of items) {
      roll -= weight;
      if (roll < 0) {
        return item;
      }
    }
    return items.at(-1)?.[0] as T;
  };
  return { amount, chance, int, pick, weighted };
};

export const round2 = (value: number) => Math.round(value * 100) / 100;
const pad = (value: number) => String(value).padStart(2, "0");

export const createCalendar = (today: Date) => {
  const monthStart = (index: number) =>
    new Date(today.getFullYear(), today.getMonth() - CURRENT + index, 1);
  const daysIn = (index: number) => {
    const start = monthStart(index);
    return new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  };
  const date = (index: number, day: number) => {
    const start = monthStart(index);
    const clamped = Math.min(Math.max(day, 1), daysIn(index));
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(clamped)}`;
  };
  const end = (index: number) => date(index, daysIn(index));
  return {
    date,
    daysIn,
    end,
    lastDay: (index: number) =>
      index === CURRENT ? today.getDate() : daysIn(index),
    opening: () => end(-1),
    today: date(CURRENT, today.getDate()),
    year: (index: number) => monthStart(index).getFullYear(),
  };
};

export type Calendar = ReturnType<typeof createCalendar>;

export const rate = (code: Code, month: number) => {
  const drift: Record<Code, number> = {
    EUR: 0.012 * Math.sin(month * 0.7) + 0.0021 * month,
    PLN: 0.009 * Math.sin(month * 1.3) + 0.0028 * month,
    UAH: 0,
    USD: 0.004 * Math.sin(month) + 0.0017 * month,
  };
  return Math.round(baseRates[code] * (1 + drift[code]) * 10_000) / 10_000;
};

const convert = (amount: number, from: Code, to: Code, month: number) =>
  (amount * rate(from, month)) / rate(to, month);

export const tripTag = (calendar: Calendar, key: string) => {
  const trip = trips.find((item) => item.key === key);
  return trip ? `travel/${trip.slug}-${calendar.year(trip.month)}` : key;
};

export const buildLedger = (calendar: Calendar) => {
  const rng = createRng(SEED);
  const entries: Entry[] = [];
  const creditSpent: number[] = new Array(HISTORY_MONTHS).fill(0);

  const at = (month: number, day: number, hour = rng.int(8, 21)) =>
    `${calendar.date(month, day)}T${pad(hour)}:${pad(rng.int(0, 59))}:00`;

  const chosen = <T>(odds?: readonly [T, number]) =>
    odds && rng.chance(odds[1]) ? odds[0] : undefined;

  const pickFrom = <T>(odds?: readonly [readonly T[], number]) => {
    const list = chosen(odds);
    return list ? rng.pick(list) : undefined;
  };

  const add = (entry: Entry) => {
    entries.push(entry);
  };

  const spend = (
    month: number,
    source: string,
    destination: string,
    price: number,
    priceCurrency: Code,
    extra: Omit<Split, "amount" | "destination" | "source">
  ): Split => {
    const currency = accountCurrency[source] ?? primaryCurrency;
    const same = currency === priceCurrency;
    const amount = round2(
      same
        ? price
        : convert(price, priceCurrency, currency, month) * CARD_MARGIN
    );
    if (source === "credit") {
      creditSpent[month] = round2((creditSpent[month] ?? 0) + amount);
    }
    const foreign = same
      ? undefined
      : { amount: round2(price), currency: priceCurrency };
    return { amount, destination, foreign, source, ...extra };
  };

  const purchase = (
    month: number,
    day: number,
    source: string,
    destination: string,
    price: number,
    priceCurrency: Code,
    { key, ...extra }: Extra
  ) => {
    const reconciled =
      month === 0 && source === "mono" && rng.chance(0.3) ? true : undefined;
    add({
      date: at(month, day),
      key,
      month,
      splits: [
        spend(month, source, destination, price, priceCurrency, {
          ...extra,
          reconciled,
        }),
      ],
      type: "withdrawal",
    });
  };

  const income = (
    month: number,
    day: number,
    source: string,
    destination: string,
    amount: number,
    { key, ...extra }: Extra
  ) => {
    add({
      date: at(month, day, rng.int(8, 12)),
      key,
      month,
      splits: [{ amount: round2(amount), destination, source, ...extra }],
      type: "deposit",
    });
  };

  const transfer = (
    month: number,
    day: number,
    source: string,
    destination: string,
    amount: number,
    { foreignAmount, key, ...extra }: Extra & { foreignAmount?: number }
  ) => {
    const from = accountCurrency[source] ?? primaryCurrency;
    const to = accountCurrency[destination] ?? primaryCurrency;
    const foreign =
      from === to
        ? undefined
        : {
            amount: round2(foreignAmount ?? convert(amount, from, to, month)),
            currency: to,
          };
    add({
      date: at(month, day),
      key,
      month,
      splits: [
        { amount: round2(amount), destination, foreign, source, ...extra },
      ],
      type: "transfer",
    });
  };

  const payBills = (month: number, lastDay: number) => {
    for (const bill of bills) {
      const yearly = bill.month !== undefined;
      const due = yearly
        ? bill.month === month
        : month <= (bill.stopAfter ?? CURRENT);
      const skipped =
        !yearly && month === CURRENT && !rng.chance(PAID_THIS_MONTH);
      if (due && bill.day <= lastDay && !skipped) {
        const [min, max] = bill.amount;
        purchase(
          month,
          bill.day,
          bill.account,
          bill.expense,
          rng.amount(min, max),
          bill.currency,
          {
            bill: bill.key,
            category: bill.category,
            description: bill.name,
            notes: pickFrom([billNotes, 0.15]),
            tags: bill.tags,
          }
        );
      }
    }
  };

  const habit = (month: number, lastDay: number, spec: Habit) => {
    const scale = lastDay / calendar.daysIn(month);
    const count = Math.round(rng.int(spec.count[0], spec.count[1]) * scale);
    for (let index = 0; index < count; index += 1) {
      const [place, , min, max, descriptions] = rng.weighted(
        spec.places.map((item) => [item, item[1]] as const)
      );
      const source = rng.weighted(spec.sources);
      const url = chosen(spec.url);
      const tags = pickFrom(spec.tags);
      purchase(
        month,
        rng.int(1, lastDay),
        source,
        place,
        rng.amount(min, max),
        spec.currency ?? "PLN",
        {
          budget: chosen(spec.budget),
          category: chosen(spec.category),
          description: rng.pick(descriptions),
          externalUrl: url ? `${url}${rng.int(100_000, 999_999)}` : undefined,
          notes: pickFrom(spec.notes),
          tags: tags ? [...tags] : undefined,
        }
      );
    }
  };

  const oneOf = <T>(value: T | readonly T[]) =>
    Array.isArray(value) ? rng.pick(value as readonly T[]) : (value as T);

  const runPlan = (month: number, lastDay: number, plan: Plan) => {
    if (plan.months !== "all" && !plan.months.includes(month)) {
      return;
    }
    const days = plan.days ?? [rng.int(1, LATEST_RANDOM_DAY)];
    for (const day of days.filter((value) => value <= lastDay)) {
      const amount =
        typeof plan.amount === "number"
          ? plan.amount
          : rng.amount(plan.amount[0], plan.amount[1], plan.step);
      const destination = oneOf(plan.destination);
      const extra: Extra = {
        budget: plan.budget,
        category: plan.category,
        description: oneOf(plan.description),
        key: plan.key?.[1] === month ? plan.key[0] : undefined,
        notes: plan.notes,
        piggy: plan.piggy,
        tags: plan.trip
          ? [...(plan.tags ?? []), tripTag(calendar, plan.trip)]
          : plan.tags && [...plan.tags],
      };
      const currency =
        plan.currency ?? accountCurrency[plan.source] ?? primaryCurrency;
      const handlers: Record<Kind, () => void> = {
        deposit: () =>
          income(month, day, plan.source, destination, amount, extra),
        transfer: () =>
          transfer(month, day, plan.source, destination, amount, extra),
        withdrawal: () =>
          purchase(
            month,
            day,
            plan.source,
            destination,
            amount,
            currency,
            extra
          ),
      };
      handlers[plan.type]();
    }
  };

  const salary = (month: number, lastDay: number) => {
    if (lastDay < 10) {
      return;
    }
    const early = month < 2;
    income(month, 10, "northwind", "wise", SALARY, {
      bookDate: early ? calendar.date(month, 11) : undefined,
      description: "Salary — Northwind Labs",
      notes: pickFrom([
        [
          `salary for ${calendar.date(month, 1).slice(0, 7)}`,
          "paid a day late",
        ],
        0.25,
      ]),
      processDate: early ? calendar.date(month, 12) : undefined,
    });
  };

  const invoices = (month: number, lastDay: number) => {
    const label = calendar.date(month, 1).slice(0, 7);
    const day = rng.int(5, 8);
    if (day <= lastDay) {
      income(month, day, "brightline", "wise", rng.amount(800, 1600, 50), {
        description: `Invoice BL-${label} — Brightline Studio`,
        externalUrl: `https://invoices.example.com/brightline/${label}`,
        key: month === 0 ? "brightlineInvoice" : undefined,
        notes: pickFrom([
          [
            "hours logged in Toggl",
            "includes the hotfix weekend",
            "paid via Wise, no fees",
          ],
          0.3,
        ]),
        tags: [
          rng.chance(0.85) ? "programming" : "Programming",
          "programming/client-a",
        ],
      });
    }
    if (month % 2 === 0 && lastDay >= 18) {
      const reimbursed = month === 4;
      income(month, 18, "kraken", "pko", rng.amount(3000, 6000, 100), {
        description: `Kraken Digital — ${rng.pick(["landing page", "API integration", "bug bash", "consulting"])}`,
        key: reimbursed ? "krakenInvoice" : undefined,
        notes: reimbursed
          ? "includes the USB-C dock they reimbursed"
          : undefined,
        tags: [rng.chance(0.8) ? "programming/client-b" : "progamming"],
      });
    }
  };

  const interest = (month: number, lastDay: number) => {
    income(month, 1, "wiseInterest", "wise", rng.amount(3, 7), {
      description: "Interest",
    });
    if (lastDay >= 2) {
      income(month, 2, "cashback", "mono", rng.amount(120, 480), {
        description: "Cashback",
      });
    }
    if (lastDay >= 28) {
      income(month, 28, "interest", "savings", rng.amount(900, 1300), {
        description: "Jar interest",
        interestDate: month >= 8 ? calendar.date(month, 27) : undefined,
      });
    }
  };

  const conversions = (month: number, lastDay: number) => {
    for (const day of [11, 25].filter((value) => value <= lastDay)) {
      const usd = rng.amount(1700, 2150, 50);
      transfer(month, day, "wise", "mono", usd, {
        description: "Wise → Mono",
        foreignAmount: usd * rate("USD", month) * SELL_SPREAD,
        notes: pickFrom([transferNotes, 0.4]),
      });
    }
    for (const day of [12, 26].filter((value) => value <= lastDay)) {
      const pln = rng.amount(2900, 3900, 100);
      transfer(
        month,
        day,
        "mono",
        "pko",
        pln * rate("PLN", month) * BUY_SPREAD,
        {
          description: "Mono → PKO",
          foreignAmount: pln,
          notes: pickFrom([transferNotes, 0.4]),
          piggy: day === 26 && month % 6 === 0 ? "synth" : undefined,
        }
      );
    }
    const owed = creditSpent[month - 1] ?? 0;
    if (lastDay >= 20 && owed > 0) {
      transfer(month, 20, "pko", "credit", owed, {
        description: "Credit card repayment",
      });
    }
  };

  const receipt = (month: number, lastDay: number) => {
    const day = rng.int(1, 28);
    if (day > lastDay) {
      return;
    }
    const shop = rng.pick(["kaufland", "carrefour"] as const);
    const source = rng.pick(["pko", "mono"]);
    add({
      date: at(month, day),
      key: month === 0 ? "receipt" : undefined,
      month,
      splits: [
        spend(month, source, shop, rng.amount(80, 220), "PLN", {
          budget: "Groceries",
          category: "Groceries",
          description: "Groceries",
        }),
        spend(month, source, shop, rng.amount(25, 90), "PLN", {
          budget: "Everything else",
          category: "Household",
          description: "Household — detergent, paper towels",
          notes: pickFrom([
            ["receipt photo attached", "bought the big pack"],
            0.4,
          ]),
        }),
      ],
      title: `${shop === "kaufland" ? "Kaufland" : "Carrefour"} — weekly shop`,
      type: "withdrawal",
    });
  };

  const sharedDinner = (month: number, lastDay: number, spec: SharedDinner) => {
    const day = rng.int(1, 28);
    if (!spec.months.includes(month) || day > lastDay) {
      return;
    }
    const total = rng.amount(spec.total[0], spec.total[1]);
    const share = round2(total * rng.amount(spec.ratio[0], spec.ratio[1]));
    add({
      date: at(month, day, 20),
      month,
      splits: [
        spend(month, spec.source, spec.place, total - share, "PLN", {
          budget: spec.budget,
          category: "Eating out",
          description: `${spec.title} — my part`,
        }),
        {
          ...spend(month, spec.source, spec.friend, share, "PLN", {
            description: spec.share,
            notes: `owes me ${share.toFixed(0)} zł`,
          }),
          foreign: undefined,
        },
      ],
      title: spec.title,
      type: "withdrawal",
    });
  };

  for (let month = 0; month < HISTORY_MONTHS; month += 1) {
    const lastDay = calendar.lastDay(month);
    salary(month, lastDay);
    invoices(month, lastDay);
    interest(month, lastDay);
    conversions(month, lastDay);
    payBills(month, lastDay);
    for (const spec of habits) {
      habit(month, lastDay, spec);
    }
    for (const plan of plans) {
      runPlan(month, lastDay, plan);
    }
    receipt(month, lastDay);
    for (const spec of sharedDinners) {
      sharedDinner(month, lastDay, spec);
    }
  }

  const next = HISTORY_MONTHS;
  add({
    date: `${calendar.date(next, 1)}T09:00:00`,
    month: next,
    splits: [
      {
        amount: RENT,
        category: "Housing",
        description: "Rent — scheduled",
        destination: "landlord",
        notes: "standing order, goes out on the 1st",
        source: "pko",
      },
    ],
    type: "withdrawal",
  });
  add({
    date: `${calendar.date(next, 1)}T09:05:00`,
    month: next,
    splits: [
      {
        amount: SAVINGS,
        description: "Savings — scheduled",
        destination: "savings",
        source: "mono",
      },
    ],
    type: "transfer",
  });

  return entries.sort((left, right) => left.date.localeCompare(right.date));
};
