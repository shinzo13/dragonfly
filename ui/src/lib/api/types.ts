import type { components } from "./schema.js";

type S = components["schemas"];

export interface Item<T> {
  attributes: T;
  id: string;
  type: string;
}
export interface Page<T> {
  data: Item<T>[];
  meta: {
    pagination?: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}
export interface One<T> {
  data: Item<T>;
}

export type Account = S["AccountProperties"];
export type Attachment = S["AttachmentProperties"];
export type AvailableBudget = S["AvailableBudgetProperties"];
export type Bill = S["BillProperties"];
export type Budget = S["BudgetProperties"];
export type BudgetLimit = S["BudgetLimitProperties"];
export type Category = S["CategoryProperties"];
export type Currency = S["CurrencyProperties"];
export type ExchangeRate = S["CurrencyExchangeProperties"];
export type LinkType = S["LinkType"];
export type ObjectGroup = S["ObjectGroup"];
export type PiggyBank = S["PiggyBankProperties"];
export type PiggyBankEvent = S["PiggyBankEventProperties"];
export type Preference = S["Preference"];
export type Recurrence = S["RecurrenceProperties"];
export type Rule = S["Rule"];
export type RuleGroup = S["RuleGroup"];
export type Tag = S["TagModel"];
export type TransactionGroup = S["Transaction"];
export type Split = S["TransactionSplit"];
export type SplitStore = S["TransactionSplitStore"];
export type TransactionStore = S["TransactionStore"];
export type TransactionLink = S["TransactionLink"];
export type UserGroup = S["UserGroupReadAttributes"];
export type Webhook = S["WebhookProperties"];
export type ChartDataSet = S["ChartDataSet"];
export type InsightGroupEntry = S["InsightGroupEntry"];
export type InsightTotalEntry = S["InsightTotalEntry"];
export type BasicSummary = S["BasicSummary"];
export type BasicSummaryEntry = S["BasicSummaryEntry"];
export type SystemInfo = S["SystemInfo"];

export type TransactionType =
  | "withdrawal"
  | "deposit"
  | "transfer"
  | "reconciliation"
  | "opening balance";

export type AccountType = "asset" | "expense" | "revenue" | "liabilities";
