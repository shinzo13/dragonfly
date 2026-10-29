import { untrack } from "svelte";
import { period } from "#lib/period.svelte.js";
import { goto } from "$app/navigation";
import { page } from "$app/state";

export function periodPath(base: string, start: string, end: string) {
  return `${base}/${start}/${end}?start=${start}&end=${end}`;
}

export function keptParams() {
  const params = new URLSearchParams(page.url.search);
  params.delete("start");
  params.delete("end");
  const rest = params.toString();
  return rest ? `&${rest}` : "";
}

export function usePeriodPath(base: () => string) {
  $effect(() => {
    const { start, end } = page.params;
    if (period.ready && start && end && start <= end) {
      untrack(() => period.set({ end, start }));
    }
  });
  $effect(() => {
    if (!period.ready) {
      return;
    }
    const { start, end } = period;
    untrack(() => {
      const { start: from, end: to } = page.params;
      if (from && to && (from !== start || to !== end)) {
        const target = base();
        setTimeout(() => {
          if (page.url.pathname.startsWith(`${target}/${from}`)) {
            goto(`${periodPath(target, start, end)}${keptParams()}`, {
              replace: true,
            });
          }
        });
      }
    });
  });
}
