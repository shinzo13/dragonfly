import { type Binding, useKeys } from "#lib/keys.svelte.js";

interface Options<T> {
  edit?: (item: T) => void;
  extra?: () => Binding[];
  id?: string;
  items: () => T[];
  key: (item: T) => string;
  open?: (item: T) => void;
  selectable?: boolean;
}

export class ListNav<T> {
  cursor = $state(-1);
  selected = $state<Set<string>>(new Set());
  anchor = -1;
  private readonly options: Options<T>;

  constructor(options: Options<T>) {
    this.options = options;
  }

  get items() {
    return this.options.items();
  }

  get current(): T | undefined {
    return this.items[this.cursor];
  }

  get selection(): T[] {
    return this.items.filter((item) =>
      this.selected.has(this.options.key(item))
    );
  }

  get targets(): T[] {
    if (this.selected.size > 0) {
      return this.selection;
    }
    return this.current ? [this.current] : [];
  }

  rowId(index: number) {
    return `${this.options.id ?? "list"}-row-${index}`;
  }

  isSelected(item: T) {
    return this.selected.has(this.options.key(item));
  }

  move(to: number) {
    const count = this.items.length;
    if (count === 0) {
      this.cursor = -1;
      return;
    }
    this.cursor = Math.max(0, Math.min(count - 1, to));
    this.reveal("nearest");
  }

  reveal(block: ScrollLogicalPosition) {
    const row = document.getElementById(this.rowId(this.cursor));
    if (!row) {
      return;
    }
    const fitsFirstScreen =
      row.getBoundingClientRect().bottom + window.scrollY <= window.innerHeight;
    if (this.cursor === 0 && block === "nearest" && fitsFirstScreen) {
      window.scrollTo({ top: 0 });
      return;
    }
    row.scrollIntoView({ block });
  }

  toggle(item: T | undefined = this.current) {
    if (!item) {
      return;
    }
    const key = this.options.key(item);
    const next = new Set(this.selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selected = next;
    this.anchor = this.items.indexOf(item);
  }

  extend(delta: number) {
    if (this.cursor < 0) {
      this.move(0);
    }
    const next = new Set(this.selected);
    if (this.current) {
      next.add(this.options.key(this.current));
    }
    this.move(this.cursor + delta);
    if (this.current) {
      next.add(this.options.key(this.current));
    }
    this.selected = next;
  }

  selectRange(index: number) {
    const from = this.anchor < 0 ? index : this.anchor;
    const [a, b] = from < index ? [from, index] : [index, from];
    const next = new Set(this.selected);
    for (const item of this.items.slice(a, b + 1)) {
      next.add(this.options.key(item));
    }
    this.selected = next;
  }

  selectAll() {
    const allSelected = this.selected.size === this.items.length;
    this.selected = allSelected
      ? new Set()
      : new Set(this.items.map((item) => this.options.key(item)));
  }

  clear() {
    this.selected = new Set();
  }

  click(index: number, event: MouseEvent) {
    this.cursor = index;
    if (!this.options.selectable) {
      return;
    }
    if (event.shiftKey) {
      this.selectRange(index);
    } else if (event.metaKey || event.ctrlKey) {
      this.toggle(this.items[index]);
    }
  }

  bindings(): Binding[] {
    const list: Binding[] = [
      {
        group: "List",
        keys: "j",
        label: "Next row",
        run: () => this.move(this.cursor + 1),
      },
      {
        group: "List",
        keys: "k",
        label: "Previous row",
        run: () => this.move(this.cursor - 1),
      },
      {
        group: "List",
        hidden: true,
        keys: "ArrowDown",
        label: "Next row",
        run: () => this.move(this.cursor + 1),
      },
      {
        group: "List",
        hidden: true,
        keys: "ArrowUp",
        label: "Previous row",
        run: () => this.move(this.cursor - 1),
      },
      {
        group: "List",
        keys: "g g",
        label: "First row",
        run: () => this.move(0),
      },
      {
        group: "List",
        keys: "G",
        label: "Last row",
        run: () => this.move(this.items.length - 1),
      },
      {
        group: "List",
        keys: "z z",
        label: "Scroll row to the middle",
        run: () => this.reveal("center"),
      },
      {
        group: "List",
        keys: "z t",
        label: "Scroll row to the top",
        run: () => this.reveal("start"),
      },
      {
        group: "List",
        keys: "z b",
        label: "Scroll row to the bottom",
        run: () => this.reveal("end"),
      },
      {
        group: "List",
        hidden: true,
        keys: "mod+d",
        label: "Half page down",
        run: () => this.move(this.cursor + 15),
      },
      {
        group: "List",
        hidden: true,
        keys: "mod+u",
        label: "Half page up",
        run: () => this.move(this.cursor - 15),
      },
    ];
    const { open, edit, selectable } = this.options;
    if (open) {
      list.push(
        {
          group: "List",
          keys: "Enter",
          label: "Open row",
          run: () => this.current && open(this.current),
        },
        {
          group: "List",
          hidden: true,
          keys: "o",
          label: "Open row",
          run: () => this.current && open(this.current),
        }
      );
    }
    if (edit) {
      list.push({
        group: "List",
        keys: "e",
        label: "Edit row",
        run: () => this.current && edit(this.current),
      });
    }
    if (selectable) {
      list.push(
        {
          group: "Selection",
          keys: "x",
          label: "Select row",
          run: () => this.toggle(),
        },
        {
          group: "Selection",
          hidden: true,
          keys: "Space",
          label: "Select row",
          run: () => this.toggle(),
        },
        {
          group: "Selection",
          keys: "J",
          label: "Extend selection down",
          run: () => this.extend(1),
        },
        {
          group: "Selection",
          keys: "K",
          label: "Extend selection up",
          run: () => this.extend(-1),
        },
        {
          group: "Selection",
          keys: "*",
          label: "Select all / none",
          run: () => this.selectAll(),
        },
        {
          group: "Selection",
          keys: "u",
          label: "Clear selection",
          run: () => this.clear(),
        }
      );
    }
    return [...list, ...(this.options.extra?.() ?? [])];
  }

  use() {
    useKeys(() => this.bindings());
  }
}
