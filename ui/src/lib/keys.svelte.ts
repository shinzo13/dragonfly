import { getContext, setContext, untrack } from "svelte";

export interface Binding {
  group?: string;
  hidden?: boolean;
  input?: boolean;
  keys: string;
  label: string;
  run: (event: KeyboardEvent) => void;
}

const SEQUENCE_MS = 1200;
const EDITABLE =
  "input, textarea, select, [contenteditable=''], [contenteditable='true']";

const LATIN_LETTER = /^[a-z]$/i;
const ANY_LETTER = /^\p{L}$/u;
const US_KEYS: Record<string, [string, string]> = {
  Backquote: ["`", "~"],
  Backslash: ["\\", "|"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Comma: [",", "<"],
  Digit0: ["0", ")"],
  Digit1: ["1", "!"],
  Digit2: ["2", "@"],
  Digit3: ["3", "#"],
  Digit4: ["4", "$"],
  Digit5: ["5", "%"],
  Digit6: ["6", "^"],
  Digit7: ["7", "&"],
  Digit8: ["8", "*"],
  Digit9: ["9", "("],
  Equal: ["=", "+"],
  Minus: ["-", "_"],
  Period: [".", ">"],
  Quote: ["'", '"'],
  Semicolon: [";", ":"],
  Slash: ["/", "?"],
};

let foreignLayout = false;

function physicalKey({ code, shiftKey }: KeyboardEvent): string | undefined {
  if (code.startsWith("Key")) {
    const letter = code.slice(3);
    return shiftKey ? letter : letter.toLowerCase();
  }
  return US_KEYS[code]?.[shiftKey ? 1 : 0];
}

function baseKey(event: KeyboardEvent): string {
  const { key } = event;
  if (key === " ") {
    return "Space";
  }
  if (key.length !== 1) {
    return key;
  }
  const foreign = !LATIN_LETTER.test(key) && ANY_LETTER.test(key);
  const plain = !(event.altKey || event.ctrlKey || event.metaKey);
  if (plain && (foreign || LATIN_LETTER.test(key))) {
    foreignLayout = foreign;
  }
  const positional = event.altKey || foreign || (plain && foreignLayout);
  return (positional && physicalKey(event)) || key;
}

function token(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push("mod");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  const key = baseKey(event);
  if (event.shiftKey && key.length > 1) {
    parts.push("shift");
  }
  parts.push(key.length === 1 && parts.length > 0 ? key.toLowerCase() : key);
  return parts.join("+");
}

export function isEditable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}

class Keys {
  layers = $state.raw<Binding[][]>([]);
  pending = $state("");
  sheetOpen = $state(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  all = $derived(this.layers.flat());

  private readonly depths = new WeakMap<Binding[], number>();

  register(bindings: Binding[], depth = 0): () => void {
    const layer = bindings;
    this.depths.set(layer, depth);
    const above = this.layers.findIndex(
      (l) => (this.depths.get(l) ?? 0) > depth
    );
    const next = [...this.layers];
    next.splice(above < 0 ? next.length : above, 0, layer);
    this.layers = next;
    return () => {
      this.layers = this.layers.filter((l) => l !== layer);
    };
  }

  private find(combo: string, editable: boolean): Binding | undefined {
    for (let i = this.layers.length - 1; i >= 0; i -= 1) {
      const match = this.layers[i].find(
        (b) => b.keys === combo && (!editable || b.input)
      );
      if (match) {
        return match;
      }
    }
  }

  private isPrefix(combo: string): boolean {
    return this.all.some((b) => b.keys.startsWith(`${combo} `));
  }

  private clear() {
    this.pending = "";
    clearTimeout(this.timer);
  }

  handle = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      document.querySelector("dialog:modal")
    ) {
      return;
    }
    if (["Shift", "Control", "Meta", "Alt"].includes(event.key)) {
      return;
    }
    const editable = isEditable(event.target);
    const current = token(event);
    const combo = this.pending ? `${this.pending} ${current}` : current;
    const binding =
      this.find(combo, editable) ??
      (this.pending ? this.find(current, editable) : undefined);
    if (binding) {
      event.preventDefault();
      this.clear();
      binding.run(event);
      return;
    }
    if (!editable && this.isPrefix(current)) {
      event.preventDefault();
      this.clear();
      this.pending = current;
      this.timer = setTimeout(() => this.clear(), SEQUENCE_MS);
      return;
    }
    this.clear();
  };
}

export const keys = new Keys();

const DEPTH = Symbol("keys-depth");

export function useKeys(bindings: () => Binding[]) {
  const depth = getContext<number | undefined>(DEPTH) ?? 0;
  setContext(DEPTH, depth + 1);
  $effect(() => {
    const list = bindings();
    return untrack(() => keys.register(list, depth));
  });
}

const APPLE = /Mac|iPhone|iPad/;
const PC_NAMES: Record<string, string> = {
  alt: "Alt",
  Enter: "↵",
  Escape: "Esc",
  mod: "Ctrl",
  shift: "Shift",
};
const MAC_NAMES: Record<string, string> = { ...PC_NAMES, alt: "⌥", mod: "⌘" };

export function prettyKeys(combo: string): string[] {
  const mac =
    typeof navigator !== "undefined" && APPLE.test(navigator.platform);
  return combo.split(" ").map((part) =>
    part
      .split("+")
      .map((piece) => (mac ? MAC_NAMES : PC_NAMES)[piece] ?? piece)
      .join(mac ? "" : "+")
  );
}
