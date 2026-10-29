import { getContext, onMount, setContext } from "svelte";
import { ListNav } from "#lib/list-nav.svelte.js";

export interface Row {
  edit?: () => void;
  expand?: () => void;
  fold?: () => void;
  key: string;
  open: () => void;
  review?: () => void;
}

interface Section {
  order: number;
  rows: () => Row[];
}

const CONTEXT = Symbol("dashboard-column");
const GROUP = "Dashboard";

class Column {
  sections = $state.raw<Section[]>([]);
  rows = $derived(this.sections.flatMap((section) => section.rows()));
  index = $derived(new Map(this.rows.map((row, i) => [row.key, i])));

  nav = new ListNav<Row>({
    edit: (row) => row.edit?.(),
    extra: () => [
      {
        group: GROUP,
        keys: "Enter",
        label: "Expand account or open row",
        run: () => this.run((row) => (row.expand ?? row.open)()),
      },
      {
        group: GROUP,
        keys: "l",
        label: "Show last transactions of the account",
        run: () => this.run((row) => (row.expand ?? row.open)()),
      },
      {
        group: GROUP,
        keys: "h",
        label: "Fold account",
        run: () => this.run((row) => row.fold?.()),
      },
      {
        group: GROUP,
        keys: "o",
        label: "Open row",
        run: () => this.run((row) => row.open()),
      },
      {
        group: GROUP,
        keys: "x",
        label: "Mark entry reviewed",
        run: () => this.run((row) => row.review?.()),
      },
    ],
    id: "dashboard",
    items: () => this.rows,
    key: (row) => row.key,
  });

  private run(action: (row: Row) => void) {
    if (this.nav.current) {
      action(this.nav.current);
    }
  }

  add(section: Section) {
    this.sections = [...this.sections, section].sort(
      (a, b) => a.order - b.order
    );
    return () => {
      this.sections = this.sections.filter((s) => s !== section);
    };
  }

  id(key: string) {
    return this.nav.rowId(this.index.get(key) ?? -1);
  }

  point(key: string) {
    this.nav.cursor = this.index.get(key) ?? -1;
  }

  rowClass(key: string) {
    return this.nav.current?.key === key
      ? "bg-row-cursor shadow-[inset_2px_0_0_var(--ff-brand)]"
      : "hover:bg-row-hover";
  }
}

export type { Column };

export function provideColumn() {
  const column = new Column();
  setContext(CONTEXT, column);
  column.nav.use();
  return column;
}

export function useColumn(order: number, rows: () => Row[]) {
  const column = getContext<Column>(CONTEXT);
  onMount(() => column.add({ order, rows }));
  return column;
}
