const MAP: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/$/, () => "/"],
  [/^\/tx\/(\d+)$/, (m) => `/transactions/show/${m[1]}`],
  [/^\/tx$/, () => "/transactions/all"],
  [/^\/acc\/(\d+)$/, (m) => `/accounts/show/${m[1]}`],
  [/^\/acc$/, () => "/accounts/asset"],
  [/^\/debts$/, () => "/accounts/liabilities"],
  [/^\/control$/, () => "/budgets"],
  [/^\/stats$/, () => "/reports"],
];

export function legacyPath(pathname: string): string {
  for (const [re, to] of MAP) {
    const match = pathname.match(re);
    if (match) {
      return to(match);
    }
  }
  return "/";
}

export function oldUrl(url: { pathname: string; searchParams: { get: (k: string) => string | null } }, which: "legacy" | "haikesan"): string {
  const path = legacyPath(url.pathname);
  const range = url.searchParams.get("start") ? `start=${url.searchParams.get("start")}&end=${url.searchParams.get("end")}` : "";
  if (which === "legacy") {
    return `${path}?ffui=old`;
  }
  const target = path === "/" ? "/dashboard" : path;
  return range ? `${target}?${range}` : target;
}
