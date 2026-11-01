import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
import CalendarClock from "@lucide/svelte/icons/calendar-clock";
import ChartColumn from "@lucide/svelte/icons/chart-column";
import ChartPie from "@lucide/svelte/icons/chart-pie";
import Cpu from "@lucide/svelte/icons/cpu";
import CreditCard from "@lucide/svelte/icons/credit-card";
import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
import PiggyBank from "@lucide/svelte/icons/piggy-bank";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import Tags from "@lucide/svelte/icons/tags";
import Upload from "@lucide/svelte/icons/upload";
import type { Component } from "svelte";

export interface NavLink {
  href: string;
  keys?: string;
  label: string;
  match?: string[];
  old?: boolean;
}

export type NavItem = NavLink & {
  icon: Component;
  children?: NavLink[];
};

export interface NavSection {
  items: NavItem[];
  title?: string;
}

export const NAV: NavSection[] = [
  {
    items: [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        keys: "g d",
        label: "Dashboard",
        match: ["/dashboard"],
      },
    ],
  },
  {
    items: [
      { href: "/budgets", icon: ChartPie, keys: "g b", label: "Budgets" },
      {
        href: "/subscriptions",
        icon: CalendarClock,
        keys: "g s",
        label: "Subscriptions",
        match: ["/subscriptions", "/bills"],
      },
      {
        href: "/piggy-banks",
        icon: PiggyBank,
        keys: "g p",
        label: "Piggy banks",
      },
    ],
    title: "Financial control",
  },
  {
    items: [
      {
        children: [
          {
            href: "/transactions/all",
            keys: "g t",
            label: "All transactions",
          },
          {
            href: "/transactions/withdrawal",
            keys: "g w",
            label: "Expenses",
          },
          {
            href: "/transactions/deposit",
            keys: "g i",
            label: "Revenue / income",
          },
          {
            href: "/transactions/transfers",
            keys: "g x",
            label: "Transfers",
            match: ["/transactions/transfers", "/transactions/transfer"],
          },
        ],
        href: "/transactions/all",
        icon: ArrowLeftRight,
        label: "Transactions",
        match: ["/transactions"],
      },
      {
        children: [
          { href: "/rules", label: "Rules", match: ["/rules", "/rule-groups"] },
          { href: "/recurring", label: "Recurring transactions" },
          { href: "/webhooks/index", label: "Webhooks", match: ["/webhooks"] },
        ],
        href: "/rules",
        icon: Cpu,
        label: "Automation",
        match: ["/rules", "/rule-groups", "/recurring", "/webhooks"],
      },
    ],
    title: "Accounting",
  },
  {
    items: [
      {
        children: [
          { href: "/accounts/asset", keys: "g a", label: "Asset accounts" },
          { href: "/accounts/expense", keys: "g e", label: "Expense accounts" },
          { href: "/accounts/revenue", keys: "g v", label: "Revenue accounts" },
          { href: "/accounts/liabilities", keys: "g l", label: "Liabilities" },
        ],
        href: "/accounts/asset",
        icon: CreditCard,
        label: "Accounts",
        match: ["/accounts", "/inactive-accounts"],
      },
      {
        children: [
          { href: "/categories", keys: "g c", label: "Categories" },
          { href: "/tags", keys: "g m", label: "Tags" },
          { href: "/groups", keys: "g o", label: "Groups" },
        ],
        href: "/categories",
        icon: Tags,
        label: "Classification",
        match: ["/categories", "/tags", "/groups"],
      },
      { href: "/reports", icon: ChartColumn, keys: "g r", label: "Reports" },
      { href: "/export", icon: Upload, label: "Export data" },
      {
        children: [
          { href: "/profile", label: "Profile", old: true },
          {
            href: "/profile/oauth",
            label: "Remote access and tokens",
            old: true,
          },
          { href: "/preferences", keys: "g ,", label: "Preferences" },
          { href: "/currencies", label: "Currencies" },
          { href: "/exchange-rates", label: "Exchange rates" },
          { href: "/administrations", label: "Financial administrations" },
          { href: "/settings", label: "System settings", old: true },
        ],
        href: "/preferences",
        icon: SlidersHorizontal,
        label: "Options",
        match: [
          "/profile",
          "/preferences",
          "/currencies",
          "/exchange-rates",
          "/administrations",
          "/settings",
        ],
      },
    ],
    title: "Others",
  },
];

export const CREATE_LINKS: NavLink[] = [
  { href: "/transactions/create/withdrawal", label: "New withdrawal" },
  { href: "/transactions/create/deposit", label: "New deposit" },
  { href: "/transactions/create/transfer", label: "New transfer" },
  { href: "/accounts/create/asset", label: "New asset account" },
  { href: "/accounts/create/expense", label: "New expense account" },
  { href: "/accounts/create/revenue", label: "New revenue account" },
  { href: "/accounts/create/liabilities", label: "New liability" },
  { href: "/budgets/create", label: "New budget" },
  { href: "/categories/create", label: "New category" },
  { href: "/piggy-banks/create", label: "New piggy bank" },
  { href: "/subscriptions/create", label: "New subscription" },
  { href: "/rules/create", label: "New rule", old: true },
  { href: "/recurring/create", label: "New recurring transaction", old: true },
];

export function allLinks(): NavLink[] {
  return NAV.flatMap((section) =>
    section.items.flatMap((item) =>
      item.children ? item.children : [item as NavLink]
    )
  );
}

export function isActive(link: NavLink, pathname: string): boolean {
  const prefixes = link.match ?? [link.href];
  return prefixes.some((prefix) =>
    prefix === "/"
      ? pathname === "/"
      : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
