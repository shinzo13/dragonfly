import {
  kindOf,
  type ListKind,
  type ReportParams,
  type ReportType,
} from "./params.js";

const KEY = "ffui.reports.form";

export interface Memory {
  accounts: string[];
  items: Partial<Record<ListKind, string[]>>;
  type: ReportType;
}

export function recall(): Memory {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (value && kindOf(value.type) && Array.isArray(value.accounts)) {
      return {
        accounts: value.accounts,
        items: value.items ?? {},
        type: value.type,
      };
    }
  } catch {
    localStorage.removeItem(KEY);
  }
  return { accounts: [], items: {}, type: "default" };
}

export function remember(
  params: Pick<ReportParams, "type" | "accounts" | "items">
) {
  const memory = recall();
  const list = kindOf(params.type)?.list;
  const next: Memory = {
    accounts: params.accounts,
    items: list ? { ...memory.items, [list]: params.items } : memory.items,
    type: params.type,
  };
  localStorage.setItem(KEY, JSON.stringify(next));
}
