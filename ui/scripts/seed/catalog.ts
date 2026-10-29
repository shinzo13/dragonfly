export type Code = "UAH" | "USD" | "PLN" | "EUR";

export const currencies: Code[] = ["UAH", "USD", "PLN", "EUR"];
export const primaryCurrency: Code = "UAH";
export const SALARY = 4200;
export const RENT = 3400;
export const SAVINGS = 6000;

export const baseRates: Record<Code, number> = {
  EUR: 47.6,
  PLN: 10.95,
  UAH: 1,
  USD: 41.3,
};

export interface AssetSpec {
  creditLimit?: number;
  currency: Code;
  frontpage?: boolean;
  key: string;
  name: string;
  notes?: string;
  number?: string;
  opening: number;
  role: "defaultAsset" | "savingAsset" | "cashWalletAsset" | "ccAsset";
}

export const assets: AssetSpec[] = [
  {
    currency: "UAH",
    frontpage: true,
    key: "mono",
    name: "Monobank Black",
    notes:
      "Main card. Most daily spending goes here, PLN is converted by the bank.",
    number: "5375 4141 0000 4417",
    opening: 48_250,
    role: "defaultAsset",
  },
  {
    currency: "PLN",
    frontpage: true,
    key: "pko",
    name: "PKO BP Konto",
    number: "PL61 1020 1026 0000 0422 7020 1111",
    opening: 8000,
    role: "defaultAsset",
  },
  {
    currency: "USD",
    frontpage: true,
    key: "wise",
    name: "Wise USD",
    notes: "Salary lands here.",
    opening: 2400,
    role: "defaultAsset",
  },
  {
    currency: "EUR",
    key: "wiseEur",
    name: "Wise EUR",
    opening: 310,
    role: "defaultAsset",
  },
  {
    currency: "UAH",
    frontpage: true,
    key: "savings",
    name: "Monobank Jar — Savings",
    opening: 120_000,
    role: "savingAsset",
  },
  {
    currency: "PLN",
    frontpage: true,
    key: "cash",
    name: "Cash wallet",
    opening: 650,
    role: "cashWalletAsset",
  },
  {
    creditLimit: 8000,
    currency: "PLN",
    frontpage: true,
    key: "credit",
    name: "Millennium Visa Credit",
    notes: "Repaid in full every month from PKO.",
    opening: 0,
    role: "ccAsset",
  },
  {
    currency: "USD",
    key: "usdt",
    name: "Binance USDT",
    opening: 1800,
    role: "defaultAsset",
  },
];

export interface LiabilitySpec {
  currency: Code;
  direction: "credit" | "debit";
  interest: number;
  key: string;
  name: string;
  notes?: string;
  opening: number;
  type: "loan" | "debt" | "mortgage";
}

export const liabilities: LiabilitySpec[] = [
  {
    currency: "UAH",
    direction: "debit",
    interest: 11.5,
    key: "mortgage",
    name: "Kyiv flat mortgage — Oschadbank",
    opening: 640_000,
    type: "mortgage",
  },
  {
    currency: "PLN",
    direction: "debit",
    interest: 7.5,
    key: "loan",
    name: "MacBook installments — Santander",
    opening: 14_400,
    type: "loan",
  },
  {
    currency: "UAH",
    direction: "credit",
    interest: 0,
    key: "ivan",
    name: "Ivan Kovalenko",
    notes: "Borrowed for the car repair, pays back in chunks.",
    opening: 6000,
    type: "debt",
  },
  {
    currency: "PLN",
    direction: "debit",
    interest: 0,
    key: "artem",
    name: "Artem Shevchuk",
    notes: "Usually pays for dinners, I settle up later.",
    opening: 400,
    type: "debt",
  },
  {
    currency: "UAH",
    direction: "credit",
    interest: 0,
    key: "oksana",
    name: "Oksana Melnyk",
    opening: 2500,
    type: "debt",
  },
  {
    currency: "USD",
    direction: "credit",
    interest: 0,
    key: "dmytro",
    name: "Dmytro Bondar",
    opening: 300,
    type: "debt",
  },
  {
    currency: "PLN",
    direction: "credit",
    interest: 0,
    key: "marta",
    name: "Marta Nowak",
    opening: 120,
    type: "debt",
  },
  {
    currency: "UAH",
    direction: "debit",
    interest: 0,
    key: "taras",
    name: "Taras Lysenko",
    notes: "Lent me money for the deposit on the flat.",
    opening: 10_000,
    type: "debt",
  },
];

export const expenses = {
  airbnb: "Airbnb",
  allegro: "Allegro",
  anthropic: "Anthropic",
  apple: "Apple",
  bar: "Bar Mleczny Prasowy",
  biedronka: "Biedronka",
  bistro: "Pierogarnia Zapiecek",
  bolt: "Bolt",
  booking: "Booking.com",
  carrefour: "Carrefour Express",
  cinema: "Cinema City",
  cloudflare: "Cloudflare",
  comeBackAlive: "Come Back Alive",
  costa: "Costa Coffee",
  cursor: "Cursor",
  dentist: "Dental Studio Smile",
  digitalocean: "DigitalOcean",
  empik: "Empik",
  flowers: "Kwiaciarnia Bukiet",
  gemini: "Apteka Gemini",
  github: "GitHub",
  glovo: "Glovo",
  google: "Google",
  hamsa: "Hamsa",
  hetzner: "Hetzner Online",
  ikea: "IKEA",
  jetbrains: "JetBrains",
  kaufland: "Kaufland",
  kyivstar: "Kyivstar",
  landlord: "Landlord — Pan Zbigniew",
  lidl: "Lidl",
  mcdonalds: "McDonald's",
  medicover: "Medicover",
  midjourney: "Midjourney",
  namecheap: "Namecheap",
  netflix: "Netflix",
  notion: "Notion",
  onepassword: "1Password",
  openai: "OpenAI",
  orange: "Orange Polska",
  perplexity: "Perplexity",
  pge: "PGE Obrót",
  pkp: "PKP Intercity",
  play: "Play",
  porkbun: "Porkbun",
  prytula: "Serhiy Prytula Foundation",
  puzata: "Puzata Hata",
  raycast: "Raycast",
  rossmann: "Rossmann",
  rozetka: "Rozetka",
  ryanair: "Ryanair",
  silpo: "Silpo",
  splice: "Splice",
  spotify: "Spotify",
  starbucks: "Starbucks",
  steam: "Steam",
  sushi: "Sushi Kushi",
  telegram: "Telegram",
  thomann: "Thomann",
  tidal: "Tidal",
  uber: "Uber",
  vet: "Vetica Clinic",
  wikimedia: "Wikimedia Foundation",
  wolt: "Wolt",
  xkom: "x-kom",
  zabka: "Żabka",
  zooplus: "Zooplus",
  ztm: "ZTM Warszawa",
} as const;

export const revenues = {
  brightline: "Brightline Studio",
  cashback: "Monobank cashback",
  interest: "Monobank Jar interest",
  kraken: "Kraken Digital",
  northwind: "Northwind Labs LLC",
  refunds: "Allegro refunds",
  taxOffice: "Urząd Skarbowy",
  wiseInterest: "Wise interest",
} as const;

export const categories = [
  "Groceries",
  "Eating out",
  "Software",
  "Hardware",
  "Transport",
  "Health",
  "Housing",
  "Household",
  "Entertainment",
  "Gifts",
  "Travel",
  "Donations",
];

export interface BudgetSpec {
  autoAmount?: number;
  name: string;
}

export const budgets: BudgetSpec[] = [
  { name: "Groceries" },
  { name: "Eating out" },
  { name: "Transport" },
  { name: "Fun" },
  { autoAmount: 6000, name: "Everything else" },
];

export interface TripSpec {
  description: string;
  key: "krakow" | "lisbon";
  month: number;
  slug: string;
}

export const trips: TripSpec[] = [
  {
    description: "Long weekend in Kraków",
    key: "krakow",
    month: 6,
    slug: "krakow",
  },
  {
    description: "Lisbon with Oksana",
    key: "lisbon",
    month: 9,
    slug: "lisbon",
  },
];

export const plainTags = [
  { description: "Anything code-related", tag: "programming" },
  { description: "Brightline Studio contract", tag: "programming/client-a" },
  { description: "Kraken Digital, ad-hoc work", tag: "programming/client-b" },
  {
    description: "ffui and other pet projects",
    tag: "programming/side-project",
  },
  { tag: "Programming" },
  { tag: "progamming" },
  { tag: "music" },
  { description: "Synths, cables, plugins", tag: "music/gear" },
  { description: "Moose the cat", tag: "moose" },
  { tag: "reimbursable" },
  { tag: "dentist" },
];

export interface BillSpec {
  account: string;
  amount: [number, number];
  category: string;
  currency: Code;
  day: number;
  expense: keyof typeof expenses;
  group?: string;
  key: string;
  month?: number;
  name: string;
  stopAfter?: number;
  tags?: string[];
}

export const bills: BillSpec[] = [
  {
    account: "wise",
    amount: [20, 20],
    category: "Software",
    currency: "USD",
    day: 3,
    expense: "openai",
    group: "1. AI",
    key: "chatgpt",
    name: "ChatGPT Plus",
  },
  {
    account: "mono",
    amount: [100, 100],
    category: "Software",
    currency: "USD",
    day: 7,
    expense: "anthropic",
    group: "1. AI",
    key: "claude",
    name: "Claude Max",
  },
  {
    account: "wise",
    amount: [20, 20],
    category: "Software",
    currency: "USD",
    day: 14,
    expense: "cursor",
    group: "1. AI",
    key: "cursor",
    name: "Cursor Pro",
    tags: ["programming"],
  },
  {
    account: "wise",
    amount: [10, 10],
    category: "Software",
    currency: "USD",
    day: 21,
    expense: "github",
    group: "1. AI",
    key: "copilot",
    name: "GitHub Copilot",
    tags: ["programming"],
  },
  {
    account: "mono",
    amount: [10, 40],
    category: "Software",
    currency: "USD",
    day: 27,
    expense: "openai",
    group: "1. AI",
    key: "openaiApi",
    name: "OpenAI API credits",
    tags: ["programming/side-project"],
  },
  {
    account: "wise",
    amount: [10, 10],
    category: "Software",
    currency: "USD",
    day: 9,
    expense: "notion",
    group: "2. Apps",
    key: "notion",
    name: "Notion Plus",
  },
  {
    account: "wise",
    amount: [8, 8],
    category: "Software",
    currency: "USD",
    day: 16,
    expense: "raycast",
    group: "2. Apps",
    key: "raycast",
    name: "Raycast Pro",
  },
  {
    account: "mono",
    amount: [4.99, 4.99],
    category: "Software",
    currency: "USD",
    day: 19,
    expense: "telegram",
    group: "2. Apps",
    key: "telegram",
    name: "Telegram Premium",
  },
  {
    account: "mono",
    amount: [49.99, 49.99],
    category: "Software",
    currency: "PLN",
    day: 24,
    expense: "apple",
    group: "2. Apps",
    key: "icloud",
    name: "iCloud+ 2 TB",
  },
  {
    account: "mono",
    amount: [29.99, 29.99],
    category: "Entertainment",
    currency: "PLN",
    day: 5,
    expense: "spotify",
    group: "3. Music",
    key: "spotify",
    name: "Spotify Premium Duo",
    tags: ["music"],
  },
  {
    account: "wise",
    amount: [12.99, 12.99],
    category: "Software",
    currency: "USD",
    day: 12,
    expense: "splice",
    group: "3. Music",
    key: "splice",
    name: "Splice Sounds+",
    tags: ["music"],
  },
  {
    account: "mono",
    amount: [25.99, 25.99],
    category: "Entertainment",
    currency: "PLN",
    day: 18,
    expense: "google",
    group: "3. Music",
    key: "youtube",
    name: "YouTube Premium",
  },
  {
    account: "mono",
    amount: [8.5, 14.2],
    category: "Software",
    currency: "EUR",
    day: 2,
    expense: "hetzner",
    group: "4. Infra",
    key: "hetzner",
    name: "Hetzner Cloud",
    tags: ["programming/side-project"],
  },
  {
    account: "wise",
    amount: [5, 5],
    category: "Software",
    currency: "USD",
    day: 6,
    expense: "cloudflare",
    group: "4. Infra",
    key: "cloudflare",
    name: "Cloudflare Workers Paid",
  },
  {
    account: "wise",
    amount: [6, 6],
    category: "Software",
    currency: "USD",
    day: 1,
    expense: "digitalocean",
    group: "4. Infra",
    key: "droplet",
    name: "DigitalOcean droplet",
  },
  {
    account: "wise",
    amount: [14.99, 14.99],
    category: "Software",
    currency: "USD",
    day: 11,
    expense: "porkbun",
    group: "5. Domains",
    key: "moosedev",
    month: 3,
    name: "moose.dev",
  },
  {
    account: "wise",
    amount: [16.98, 16.98],
    category: "Software",
    currency: "USD",
    day: 4,
    expense: "namecheap",
    group: "5. Domains",
    key: "ffuiapp",
    month: 0,
    name: "ffui.app",
  },
  {
    account: "wise",
    amount: [11.48, 11.48],
    category: "Software",
    currency: "USD",
    day: 20,
    expense: "namecheap",
    group: "5. Domains",
    key: "sidexyz",
    month: 8,
    name: "side-project.xyz",
  },
  {
    account: "wise",
    amount: [28, 28],
    category: "Software",
    currency: "USD",
    day: 28,
    expense: "porkbun",
    group: "5. Domains",
    key: "olehcodes",
    month: 11,
    name: "oleh.codes",
  },
  {
    account: "mono",
    amount: [500, 500],
    category: "Donations",
    currency: "UAH",
    day: 1,
    expense: "comeBackAlive",
    group: "6. Donations",
    key: "cba",
    name: "Come Back Alive",
  },
  {
    account: "mono",
    amount: [300, 300],
    category: "Donations",
    currency: "UAH",
    day: 15,
    expense: "prytula",
    group: "6. Donations",
    key: "prytula",
    name: "Prytula Foundation",
  },
  {
    account: "pko",
    amount: [20, 20],
    category: "Donations",
    currency: "PLN",
    day: 20,
    expense: "wikimedia",
    group: "6. Donations",
    key: "wikimedia",
    name: "Wikimedia",
  },
  {
    account: "wise",
    amount: [289, 289],
    category: "Software",
    currency: "USD",
    day: 17,
    expense: "jetbrains",
    group: "Yearly",
    key: "jetbrains",
    month: 6,
    name: "JetBrains All Products Pack",
    tags: ["programming"],
  },
  {
    account: "wise",
    amount: [59.88, 59.88],
    category: "Software",
    currency: "USD",
    day: 8,
    expense: "onepassword",
    group: "Yearly",
    key: "onepassword",
    month: 1,
    name: "1Password Families",
  },
  {
    account: "wise",
    amount: [99, 99],
    category: "Software",
    currency: "USD",
    day: 11,
    expense: "apple",
    group: "Yearly",
    key: "appledev",
    month: 1,
    name: "Apple Developer Program",
  },
  {
    account: "mono",
    amount: [49, 49],
    category: "Entertainment",
    currency: "PLN",
    day: 13,
    expense: "netflix",
    group: "Inactive",
    key: "netflix",
    name: "Netflix Standard",
    stopAfter: 3,
  },
  {
    account: "wise",
    amount: [10, 10],
    category: "Software",
    currency: "USD",
    day: 23,
    expense: "midjourney",
    group: "Inactive",
    key: "midjourney",
    name: "Midjourney Basic",
    stopAfter: 5,
  },
  {
    account: "mono",
    amount: [29.99, 29.99],
    category: "Entertainment",
    currency: "PLN",
    day: 10,
    expense: "tidal",
    group: "Inactive",
    key: "tidal",
    name: "Tidal HiFi",
    stopAfter: 1,
    tags: ["music"],
  },
  {
    account: "wise",
    amount: [20, 20],
    category: "Software",
    currency: "USD",
    day: 26,
    expense: "perplexity",
    group: "Inactive",
    key: "perplexity",
    name: "Perplexity Pro",
    stopAfter: 7,
  },
  {
    account: "pko",
    amount: [3400, 3400],
    category: "Housing",
    currency: "PLN",
    day: 1,
    expense: "landlord",
    key: "rent",
    name: "Rent",
  },
  {
    account: "pko",
    amount: [140, 290],
    category: "Housing",
    currency: "PLN",
    day: 18,
    expense: "pge",
    key: "electricity",
    name: "Electricity — PGE",
  },
  {
    account: "pko",
    amount: [69, 69],
    category: "Housing",
    currency: "PLN",
    day: 8,
    expense: "orange",
    key: "internet",
    name: "Internet — Orange",
  },
  {
    account: "pko",
    amount: [45, 45],
    category: "Housing",
    currency: "PLN",
    day: 22,
    expense: "play",
    key: "mobile",
    name: "Play mobile",
  },
  {
    account: "mono",
    amount: [150, 150],
    category: "Housing",
    currency: "UAH",
    day: 3,
    expense: "kyivstar",
    key: "kyivstar",
    name: "Kyivstar",
  },
  {
    account: "pko",
    amount: [189, 189],
    category: "Health",
    currency: "PLN",
    day: 1,
    expense: "medicover",
    key: "medicover",
    name: "Medicover",
  },
];

export interface PiggySpec {
  account: string;
  current: number;
  group: string;
  key: string;
  name: string;
  notes?: string;
  target: number;
  targetMonths?: number;
}

export const piggyBanks: PiggySpec[] = [
  {
    account: "savings",
    current: 40_000,
    group: "Safety",
    key: "emergency",
    name: "Emergency fund",
    notes: "Six months of expenses.",
    target: 300_000,
    targetMonths: 14,
  },
  {
    account: "savings",
    current: 0,
    group: "Gear",
    key: "macbook",
    name: "MacBook Pro M5",
    target: 110_000,
    targetMonths: 4,
  },
  {
    account: "pko",
    current: 500,
    group: "Gear",
    key: "synth",
    name: "Moog Matriarch",
    notes: "Saving a bit of every PLN top-up.",
    target: 9000,
  },
  {
    account: "usdt",
    current: 300,
    group: "Travel",
    key: "japan",
    name: "Japan 2027",
    target: 5000,
    targetMonths: 6,
  },
];
