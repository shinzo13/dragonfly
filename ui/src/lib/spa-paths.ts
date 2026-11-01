export const SPA_EXACT = [
  "/",
  "/home",
  "/dashboard",
  "/tx",
  "/acc",
  "/debts",
  "/control",
  "/stats",
  "/sync",
  "/accounts",
  "/budgets",
  "/categories",
  "/tags",
  "/bills",
  "/subscriptions",
  "/piggy-banks",
  "/groups",
  "/reports",
  "/search",
  "/currencies",
  "/exchange-rates",
  "/attachments",
  "/preferences",
  "/export",
  "/administrations",
  "/recurring",
  "/webhooks/index",
  "/settings/links",
  "/settings/links/create",
];

export const SPA_PREFIXES = [
  "/tx/",
  "/acc/",
  "/accounts/",
  "/inactive-accounts/",
  "/transactions/",
  "/budgets/",
  "/categories/",
  "/tags/",
  "/bills/",
  "/subscriptions/",
  "/piggy-banks/",
  "/groups/",
  "/reports/",
  "/currencies/",
  "/exchange-rates/",
  "/attachments/",
  "/administrations/",
  "/recurring/show/",
  "/webhooks/show/",
  "/settings/links/show/",
  "/settings/links/edit/",
];

export const FIREFLY_PREFIXES = [
  "/attachments/download/",
  "/attachments/view/",
  "/transactions/convert/",
  "/transactions/debug/",
  "/transactions/link/",
  "/transactions/mass/",
  "/transactions/bulk/",
  "/transactions/show-by-journal/",
  "/piggy-banks/add/",
  "/piggy-banks/remove/",
  "/reports/options/",
];

export function isSpaPath(pathname: string): boolean {
  if (FIREFLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return (
    SPA_EXACT.includes(pathname) ||
    SPA_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function oldUiUrl(href: string, sticky = false): string {
  const target = new URL(href);
  target.searchParams.set("ffui", sticky ? "off" : "old");
  return target.pathname + target.search + target.hash;
}
