import { onMount } from "svelte";

export const mobile = $state({ menu: false, narrow: false, toast: "" });

export function useMobile() {
  onMount(() => {
    const query = matchMedia("(max-width: 760px)");
    const update = () => {
      mobile.narrow = query.matches;
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  });
}

const EDITABLE = "input, textarea, select, [contenteditable]";

function outsideFields(event: Event) {
  if (!(event.target instanceof Element && event.target.closest(EDITABLE))) {
    event.preventDefault();
  }
}

export function useNative() {
  onMount(() => {
    if (!matchMedia("(pointer: coarse)").matches) {
      return;
    }
    const events = ["contextmenu", "selectstart", "dragstart"] as const;
    for (const name of events) {
      document.addEventListener(name, outsideFields);
    }
    return () => {
      for (const name of events) {
        document.removeEventListener(name, outsideFields);
      }
    };
  });
}

const HOLD_MS = 450;
const SLOP_PX = 8;
const TOAST_MS = 1400;
const NOT_NUMBER = /[^\d,.]/g;
const EDGES = /^[,.]+|[,.]+$/g;

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function say(text: string) {
  mobile.toast = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    mobile.toast = "";
  }, TOAST_MS);
}

function amountOf(el: Element): string {
  return (el.textContent ?? "").replace(NOT_NUMBER, "").replace(EDGES, "");
}

async function copy(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) {
    throw new Error("copy failed");
  }
}

export function useCopy() {
  onMount(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start = { x: 0, y: 0 };
    let swallow = false;
    const cancel = () => clearTimeout(timer);
    const down = (event: PointerEvent) => {
      const el = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
      if (!el || event.pointerType === "mouse") {
        return;
      }
      start = { x: event.clientX, y: event.clientY };
      timer = setTimeout(async () => {
        const text = amountOf(el);
        if (!text) {
          return;
        }
        swallow = true;
        navigator.vibrate?.(12);
        el.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], {
          duration: 260,
          easing: "cubic-bezier(.3,1.6,.5,1)",
        });
        try {
          await copy(text);
          say(`Copied ${text}`);
        } catch {
          say("Could not copy");
        }
      }, HOLD_MS);
    };
    const move = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX) {
        cancel();
      }
    };
    const click = (event: MouseEvent) => {
      if (swallow) {
        swallow = false;
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const up = () => {
      cancel();
      setTimeout(() => {
        swallow = false;
      }, 400);
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("click", click, true);
    return () => {
      cancel();
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("click", click, true);
    };
  });
}
