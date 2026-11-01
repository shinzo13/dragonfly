import { mode, setMode } from "mode-watcher";
import { keys, useKeys } from "#lib/keys.svelte.js";
import { display } from "#lib/money/display.svelte.js";
import { period } from "#lib/period.svelte.js";
import { session } from "#lib/session.svelte.js";
import { ui } from "#lib/ui.svelte.js";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import { forms } from "./forms/forms.svelte.js";
import { view } from "./money.svelte.js";
import { oldUrl } from "./paths.js";

export async function toggleTheme() {
  const next = mode.current === "dark" ? "light" : "dark";
  setMode(next);
  await session.setPreference("darkMode", next);
}

function cycleCurrency() {
  const codes = display.options.map((c) => c.code);
  const at = view.original ? -1 : codes.indexOf(view.code);
  if (at === codes.length - 1) {
    view.chooseOriginal();
  } else {
    view.choose(codes[at + 1]);
  }
}

export function useShellKeys() {
  useKeys(() => [
    { group: "Everywhere", input: true, keys: "mod+k", label: "Jump to anything", run: () => ui.openPalette() },
    { group: "Everywhere", keys: "?", label: "Keyboard shortcuts", run: () => (keys.sheetOpen = !keys.sheetOpen) },
    { group: "Everywhere", keys: "/", label: "Search transactions", run: () => goto("/tx?focus=1") },
    { group: "Everywhere", keys: "[", label: "Previous period", run: () => period.shift(-1) },
    { group: "Everywhere", keys: "]", label: "Next period", run: () => period.shift(1) },
    { group: "Everywhere", keys: ".", label: "Current period", run: () => period.reset() },
    { group: "Everywhere", keys: "p p", label: "Choose a period", run: () => (ui.periodOpen = true) },
    { group: "Everywhere", keys: "$", label: "Next display currency", run: cycleCurrency },
    { group: "Everywhere", keys: "t", label: "Toggle theme", run: toggleTheme },
    { group: "Everywhere", keys: "n", label: "New transaction", run: () => (forms.newTx = true) },
    { group: "Everywhere", keys: "N", label: "New transaction, full editor", run: () => goto("/transactions/create/withdrawal") },
    { group: "Everywhere", keys: "H", label: "Back", run: () => history.back() },
    { group: "Go to", keys: "g o", label: "Overview", run: () => goto("/") },
    { group: "Go to", keys: "g t", label: "Transactions", run: () => goto("/tx") },
    { group: "Go to", keys: "g a", label: "Accounts", run: () => goto("/acc") },
    { group: "Go to", keys: "g d", label: "Debts", run: () => goto("/debts") },
    { group: "Go to", keys: "g c", label: "Control", run: () => goto("/control") },
    { group: "Go to", keys: "g s", label: "Stats", run: () => goto("/stats") },
    { group: "Go to", keys: "g y", label: "Sync", run: () => goto("/sync") },
    { group: "Older interfaces", keys: "O", label: "This page in firefly-legacy", run: () => location.assign(oldUrl(page.url, "legacy")) },
    { group: "Older interfaces", keys: "A", label: "This page in firefly-haikesan", run: () => goto(oldUrl(page.url, "haikesan")) },
  ]);
}
