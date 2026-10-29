import { type Code, type expenses, SAVINGS } from "./catalog.ts";

export type Kind = "withdrawal" | "deposit" | "transfer";
type Place = keyof typeof expenses;
type Odds<T> = readonly [T, number];

export interface Habit {
  budget?: Odds<string>;
  category: Odds<string>;
  count: readonly [number, number];
  currency?: Code;
  notes?: Odds<readonly string[]>;
  places: readonly (readonly [
    Place,
    number,
    number,
    number,
    readonly string[],
  ])[];
  sources: readonly Odds<string>[];
  tags?: Odds<readonly (readonly string[])[]>;
  url?: Odds<string>;
}

export interface Plan {
  amount: number | readonly [number, number];
  budget?: string;
  category?: string;
  currency?: Code;
  days?: readonly number[];
  description: string | readonly string[];
  destination: string | readonly string[];
  key?: readonly [string, number];
  months: readonly number[] | "all";
  notes?: string;
  piggy?: string;
  source: string;
  step?: number;
  tags?: readonly string[];
  trip?: "krakow" | "lisbon";
  type: Kind;
}

export const groceryNotes = [
  "weekly shop",
  "split with Ivan, he owes 43 zł",
  "forgot bags again",
  "stuff for the Friday party",
  "Moose's food included",
  "promo on coffee, took 3",
  "self-checkout was broken, queued 15 min",
];

export const transferNotes = [
  "for rent",
  "topping up for groceries",
  "rate was ok today",
  "moving money before the weekend",
];

export const billNotes = [
  "price went up again",
  "charged in USD, bank fee ~1.5%",
  "switch to yearly?",
  "invoice in email",
];

export const habits: Habit[] = [
  {
    budget: ["Groceries", 0.85],
    category: ["Groceries", 0.9],
    count: [26, 32],
    notes: [groceryNotes, 0.28],
    places: [
      [
        "biedronka",
        6,
        25,
        220,
        ["Groceries — Biedronka", "Weekly shop — Biedronka"],
      ],
      ["lidl", 5, 30, 240, ["Groceries — Lidl", "Food — Lidl"]],
      ["zabka", 4, 8, 45, ["Żabka — snacks", "Żabka — hot dog and coffee"]],
      ["carrefour", 2, 15, 120, ["Carrefour Express"]],
      ["kaufland", 2, 60, 320, ["Groceries — Kaufland"]],
    ],
    sources: [
      ["mono", 55],
      ["pko", 25],
      ["cash", 14],
      ["credit", 6],
    ],
    tags: [[["moose"]], 0.12],
  },
  {
    budget: ["Eating out", 0.7],
    category: ["Eating out", 0.9],
    count: [24, 30],
    notes: [
      [
        "lunch with Marta",
        "team lunch, will expense",
        "dinner with Artem, he paid tips",
        "coffee before standup",
        "date night",
        "worked from here half the day",
        "ordered too much again",
      ],
      0.32,
    ],
    places: [
      ["starbucks", 4, 14, 32, ["Coffee — Starbucks"]],
      ["costa", 3, 12, 28, ["Coffee — Costa"]],
      ["mcdonalds", 2, 22, 55, ["Quick bite — McDonald's"]],
      ["bar", 2, 18, 40, ["Lunch — Bar Mleczny"]],
      ["bistro", 2, 55, 160, ["Dinner — pierogi"]],
      ["hamsa", 1, 70, 240, ["Dinner — Hamsa"]],
      ["sushi", 1, 80, 260, ["Sushi"]],
      ["wolt", 3, 45, 120, ["Delivery — Wolt"]],
      ["glovo", 2, 40, 110, ["Delivery — Glovo"]],
    ],
    sources: [
      ["mono", 50],
      ["credit", 25],
      ["pko", 15],
      ["cash", 10],
    ],
    tags: [[["reimbursable"], ["programming/side-project"]], 0.16],
  },
  {
    budget: ["Transport", 0.8],
    category: ["Transport", 0.92],
    count: [12, 16],
    notes: [
      [
        "airport",
        "late night ride home",
        "rain, no bus",
        "to the coworking",
        "surge pricing, ugh",
      ],
      0.3,
    ],
    places: [
      ["bolt", 3, 14, 65, ["Bolt ride"]],
      ["uber", 1, 14, 65, ["Uber trip"]],
    ],
    sources: [
      ["mono", 60],
      ["credit", 40],
    ],
  },
  {
    budget: ["Everything else", 0.5],
    category: ["Health", 0.9],
    count: [1, 3],
    places: [
      [
        "gemini",
        1,
        18,
        140,
        ["Pharmacy", "Vitamins", "Ibuprofen and plasters", "Allergy pills"],
      ],
    ],
    sources: [
      ["mono", 1],
      ["pko", 1],
    ],
  },
  {
    budget: ["Everything else", 0.5],
    category: ["Household", 0.85],
    count: [2, 3],
    notes: [["shampoo + toothpaste", "cleaning stuff", "gift wrap"], 0.15],
    places: [["rossmann", 1, 20, 150, ["Rossmann — toiletries"]]],
    sources: [
      ["mono", 1],
      ["pko", 1],
      ["cash", 1],
    ],
  },
  {
    budget: ["Fun", 0.7],
    category: ["Entertainment", 0.9],
    count: [1, 2],
    places: [
      [
        "cinema",
        1,
        32,
        70,
        ["Cinema — two tickets", "Cinema + popcorn", "IMAX"],
      ],
    ],
    sources: [["mono", 1]],
  },
  {
    budget: ["Fun", 0.7],
    category: ["Entertainment", 1],
    count: [0, 1],
    currency: "USD",
    places: [
      [
        "steam",
        1,
        5,
        40,
        [
          "Steam — Factorio DLC",
          "Steam sale",
          "Steam — Balatro",
          "Steam — gift for Dmytro",
        ],
      ],
    ],
    sources: [["wise", 1]],
  },
  {
    budget: ["Fun", 0.7],
    category: ["Gifts", 1],
    count: [0, 1],
    notes: [
      ["for Marta's birthday", "mom's name day", "housewarming at Artem's"],
      0.4,
    ],
    places: [
      ["flowers", 1, 60, 180, ["Flowers"]],
      ["empik", 1, 50, 200, ["Book as a gift"]],
    ],
    sources: [
      ["mono", 1],
      ["credit", 1],
    ],
  },
  {
    category: ["Hardware", 1],
    count: [0, 1],
    places: [
      [
        "xkom",
        1,
        80,
        2500,
        [
          "Mechanical keyboard switches",
          "USB-C hub",
          "SSD 2 TB",
          "Monitor arm",
          "Webcam",
        ],
      ],
    ],
    sources: [
      ["credit", 1],
      ["pko", 1],
    ],
    tags: [[["programming"], ["Programming"]], 0.3],
  },
  {
    category: ["Household", 0.6],
    count: [0, 1],
    places: [
      [
        "allegro",
        1,
        30,
        400,
        ["Phone case", "Kitchen scale", "Desk lamp", "LED strip", "Plant pots"],
      ],
    ],
    sources: [
      ["credit", 1],
      ["pko", 1],
    ],
    url: ["https://allegro.pl/moje-allegro/zakupy/kupione/", 0.6],
  },
];

const EVEN = [0, 2, 4, 6, 8, 10];
const ODD = [1, 3, 5, 7, 9, 11];

export const plans: Plan[] = [
  {
    amount: 14_500,
    category: "Housing",
    days: [15],
    description: "Mortgage payment",
    destination: "mortgage",
    months: "all",
    source: "mono",
    type: "withdrawal",
  },
  {
    amount: 800,
    days: [5],
    description: "MacBook installment",
    destination: "loan",
    months: "all",
    source: "pko",
    type: "withdrawal",
  },
  {
    amount: SAVINGS,
    days: [11],
    description: "Savings — emergency fund",
    destination: "savings",
    months: "all",
    piggy: "emergency",
    source: "mono",
    type: "transfer",
  },
  {
    amount: 4000,
    days: [26],
    description: "Savings — MacBook",
    destination: "savings",
    months: "all",
    piggy: "macbook",
    source: "mono",
    type: "transfer",
  },
  {
    amount: [150, 250],
    days: [15],
    description: "Wise → Binance",
    destination: "usdt",
    months: "all",
    piggy: "japan",
    source: "wise",
    step: 10,
    type: "transfer",
  },
  {
    amount: [750, 950],
    days: [7],
    description: "ATM withdrawal",
    destination: "cash",
    months: "all",
    source: "pko",
    step: 50,
    type: "transfer",
  },
  {
    amount: 110,
    budget: "Transport",
    category: "Transport",
    days: [2],
    description: "ZTM 30-day ticket",
    destination: "ztm",
    months: "all",
    source: "pko",
    type: "withdrawal",
  },
  {
    amount: [120, 260],
    category: "Household",
    description: "Zooplus — cat food and litter",
    destination: "zooplus",
    months: "all",
    source: "pko",
    tags: ["moose"],
    type: "withdrawal",
  },
  {
    amount: [150, 450],
    category: "Health",
    days: [12],
    description: "Vet — Moose check-up",
    destination: "vet",
    months: [2, 6, 10],
    notes: "vaccines next time",
    source: "pko",
    tags: ["moose"],
    type: "withdrawal",
  },
  {
    amount: [250, 900],
    category: "Health",
    description: [
      "Dentist — filling",
      "Dentist — cleaning",
      "Dentist — check-up",
    ],
    destination: "dentist",
    months: [1, 5, 10],
    source: "pko",
    step: 10,
    tags: ["dentist"],
    type: "withdrawal",
  },
  {
    amount: [150, 1200],
    budget: "Everything else",
    category: "Household",
    days: [7],
    description: [
      "IKEA — shelves and boxes",
      "IKEA — kitchen stuff",
      "IKEA — lamp and plants",
    ],
    destination: "ikea",
    key: ["ikea", 4],
    months: [1, 4, 7, 10],
    source: "credit",
    type: "withdrawal",
  },
  {
    amount: 5000,
    days: [9],
    description: "Lent Ivan for the car repair",
    destination: "ivan",
    key: ["lendIvan", 1],
    months: [1],
    notes: "he'll return 2k every other month",
    source: "mono",
    type: "withdrawal",
  },
  {
    amount: 2000,
    days: [4],
    description: "Ivan paid back",
    destination: "mono",
    key: ["ivanPaid", 3],
    months: [3, 5, 7, 9, 11],
    source: "ivan",
    type: "deposit",
  },
  {
    amount: [85, 160],
    category: "Eating out",
    description: "Artem paid for dinner",
    destination: ["hamsa", "sushi"],
    key: ["artemDinner", 2],
    months: EVEN,
    notes: "I owe him, settle up next month",
    source: "artem",
    type: "withdrawal",
  },
  {
    amount: 200,
    description: "Paid back Artem",
    destination: "artem",
    key: ["payArtem", 3],
    months: [1, 3, 5, 7, 9],
    notes: "BLIK",
    source: "pko",
    type: "withdrawal",
  },
  {
    amount: 1500,
    days: [6],
    description: "Paid back Taras",
    destination: "taras",
    months: EVEN,
    source: "mono",
    type: "withdrawal",
  },
  {
    amount: 1500,
    description: "Oksana paid back",
    destination: "mono",
    months: [4, 8, 10],
    notes: "for the dinners",
    source: "oksana",
    type: "deposit",
  },
  {
    amount: 200,
    days: [17],
    description: "Lent Dmytro",
    destination: "dmytro",
    months: [2],
    notes: "until his salary",
    source: "wise",
    type: "withdrawal",
  },
  {
    amount: 500,
    days: [3],
    description: "Dmytro paid back",
    destination: "wise",
    months: [6],
    notes: "all settled with Dmytro",
    source: "dmytro",
    type: "deposit",
  },
  {
    amount: 240,
    days: [12],
    description: "Marta — BLIK for concert tickets",
    destination: "pko",
    months: [7],
    source: "marta",
    type: "deposit",
  },
  {
    amount: [450, 1600],
    budget: "Groceries",
    category: "Groceries",
    days: [21, 24, 28],
    description: "Silpo — groceries in Kyiv",
    destination: "silpo",
    months: [1],
    source: "mono",
    type: "withdrawal",
  },
  {
    amount: [250, 600],
    category: "Eating out",
    days: [22, 27],
    description: "Puzata Hata",
    destination: "puzata",
    months: [1],
    source: "mono",
    type: "withdrawal",
  },
  {
    amount: [1500, 3500],
    category: "Gifts",
    days: [23],
    description: "Rozetka — gift for parents",
    destination: "rozetka",
    months: [1],
    notes: "air purifier for mom",
    source: "mono",
    type: "withdrawal",
  },
  {
    amount: 389,
    category: "Hardware",
    days: [14],
    description: "USB-C dock for client work",
    destination: "xkom",
    key: ["dock", 3],
    months: [3],
    source: "credit",
    tags: ["reimbursable", "programming/client-b"],
    type: "withdrawal",
  },
  {
    amount: 89.99,
    category: "Hardware",
    days: [9],
    description: "Bluetooth headphones (returned)",
    destination: "allegro",
    key: ["allegroPurchase", 4],
    months: [4],
    source: "pko",
    type: "withdrawal",
  },
  {
    amount: 89.99,
    days: [20],
    description: "Allegro refund — headphones",
    destination: "pko",
    key: ["allegroRefund", 4],
    months: [4],
    source: "refunds",
    type: "deposit",
  },
  {
    amount: 1840,
    days: [22],
    description: "PIT refund",
    destination: "pko",
    months: [6],
    notes: "tax return for last year",
    source: "taxOffice",
    type: "deposit",
  },
  {
    amount: [120, 250],
    category: "Hardware",
    days: [19],
    description: "Thomann — MIDI controller",
    destination: "thomann",
    months: [2],
    source: "wiseEur",
    tags: ["music", "music/gear"],
    type: "withdrawal",
  },
  {
    amount: [90, 200],
    category: "Hardware",
    days: [3],
    description: "Thomann — cables and stand",
    destination: "thomann",
    months: [10],
    source: "wiseEur",
    tags: ["music/gear"],
    type: "withdrawal",
  },
  {
    amount: [89, 149],
    category: "Travel",
    days: [14],
    description: "PKP Intercity Warszawa–Kraków",
    destination: "pkp",
    months: [6],
    source: "pko",
    trip: "krakow",
    type: "withdrawal",
  },
  {
    amount: 640,
    category: "Travel",
    days: [14],
    description: "Hotel Stary — 2 nights",
    destination: "booking",
    months: [6],
    notes: "booked via Booking.com, free cancellation",
    source: "credit",
    trip: "krakow",
    type: "withdrawal",
  },
  {
    amount: [89, 149],
    category: "Travel",
    days: [16],
    description: "PKP Intercity Kraków–Warszawa",
    destination: "pkp",
    months: [6],
    notes: "train delayed 40 min",
    source: "pko",
    trip: "krakow",
    type: "withdrawal",
  },
  {
    amount: [25, 140],
    category: "Eating out",
    days: [14, 15, 15, 16],
    description: [
      "Pierogi on Kazimierz",
      "Lunch near Wawel",
      "Coffee on Rynek",
      "Zapiekanka at Plac Nowy",
    ],
    destination: ["bistro", "bar", "starbucks"],
    months: [6],
    source: "mono",
    trip: "krakow",
    type: "withdrawal",
  },
  {
    amount: 189,
    category: "Travel",
    currency: "EUR",
    days: [9],
    description: "Ryanair WAW–LIS",
    destination: "ryanair",
    months: [7],
    source: "credit",
    trip: "lisbon",
    type: "withdrawal",
  },
  {
    amount: 900,
    days: [2],
    description: "Wise USD → EUR",
    destination: "wiseEur",
    months: [9],
    notes: "for Lisbon",
    source: "wise",
    type: "transfer",
  },
  {
    amount: 420,
    category: "Travel",
    days: [3],
    description: "Airbnb Alfama — 5 nights",
    destination: "airbnb",
    months: [9],
    source: "wiseEur",
    trip: "lisbon",
    type: "withdrawal",
  },
  {
    amount: [18, 65],
    category: "Eating out",
    days: [8, 9, 10, 11, 12],
    description: [
      "Pastéis de nata",
      "Dinner in Bairro Alto",
      "Seafood at Time Out Market",
      "Coffee in Alfama",
      "Bifana",
    ],
    destination: ["bistro", "starbucks", "sushi"],
    months: [9],
    source: "wiseEur",
    trip: "lisbon",
    type: "withdrawal",
  },
  {
    amount: [8, 20],
    category: "Travel",
    days: [8, 13],
    description: "Uber in Lisbon",
    destination: "uber",
    months: [9],
    source: "wiseEur",
    trip: "lisbon",
    type: "withdrawal",
  },
];

export interface SharedDinner {
  budget?: string;
  friend: string;
  months: readonly number[];
  place: Place;
  ratio: readonly [number, number];
  share: string;
  source: string;
  title: string;
  total: readonly [number, number];
}

export const sharedDinners: SharedDinner[] = [
  {
    budget: "Eating out",
    friend: "oksana",
    months: ODD,
    place: "hamsa",
    ratio: [0.4, 0.5],
    share: "Oksana's share",
    source: "mono",
    title: "Dinner at Hamsa",
    total: [160, 320],
  },
  {
    friend: "marta",
    months: [2, 6, 10],
    place: "sushi",
    ratio: [0.5, 0.5],
    share: "Marta's half",
    source: "pko",
    title: "Sushi with Marta",
    total: [120, 240],
  },
];
