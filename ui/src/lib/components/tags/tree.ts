import type { Item, Tag } from "#lib/api/types.js";
import {
  add,
  curOfSplit,
  type Row,
  type Sums,
} from "#lib/components/categories/sums.js";
import { toNumber } from "#lib/format.js";

export interface TagNode {
  children: TagNode[];
  depth: number;
  name: string;
  path: string;
  tag?: Item<Tag>;
}

export interface Stats {
  count: number;
  earned: Sums;
  spent: Sums;
}

const SEPARATOR = "/";
const TOKEN = /[-_/.\s]+/;
const DIACRITICS = /\p{Diacritic}/gu;
const NOT_WORD = /[^\p{L}\p{N}/]+/gu;
const NUMERIC = /^\d+$/;
const SHORT_TOKEN = 2;
const NEAR_ONE = 5;
const NEAR_TWO = 10;

const byName = (a: TagNode, b: TagNode) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
  a.name.localeCompare(b.name);

export function buildTree(tags: Item<Tag>[]): TagNode[] {
  const nodes = new Map<string, TagNode>();
  const roots: TagNode[] = [];
  const ensure = (path: string): TagNode => {
    const found = nodes.get(path);
    if (found) {
      return found;
    }
    const cut = path.lastIndexOf(SEPARATOR);
    const node: TagNode = {
      children: [],
      depth: 0,
      name: cut < 0 ? path : path.slice(cut + 1),
      path,
    };
    nodes.set(path, node);
    if (cut > 0) {
      const parent = ensure(path.slice(0, cut));
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    return node;
  };
  for (const tag of tags) {
    ensure(tag.attributes.tag).tag = tag;
  }
  const sortDeep = (list: TagNode[]) => {
    list.sort(byName);
    for (const node of list) {
      sortDeep(node.children);
    }
  };
  sortDeep(roots);
  return roots;
}

export function flatten(roots: TagNode[]): TagNode[] {
  return roots.flatMap((node) => [node, ...flatten(node.children)]);
}

export function flatNodes(tags: Item<Tag>[]): TagNode[] {
  return tags
    .map((tag) => ({
      children: [],
      depth: 0,
      name: tag.attributes.tag,
      path: tag.attributes.tag,
      tag,
    }))
    .sort(byName);
}

export function descendants(node: TagNode): TagNode[] {
  return flatten(node.children);
}

const emptyStats = (): Stats => ({ count: 0, earned: {}, spent: {} });

function pathsOf(tags: string[], rollup: boolean): Set<string> {
  const paths = new Set<string>();
  for (const tag of tags) {
    paths.add(tag);
    let cut = rollup ? tag.lastIndexOf(SEPARATOR) : -1;
    while (cut > 0) {
      paths.add(tag.slice(0, cut));
      cut = tag.lastIndexOf(SEPARATOR, cut - 1);
    }
  }
  return paths;
}

export function tagStats(items: Row[], rollup: boolean): Map<string, Stats> {
  const stats = new Map<string, Stats>();
  const groups = new Map<string, Set<string>>();
  for (const { group, split } of items) {
    const paths = pathsOf(split.tags ?? [], rollup);
    const amount = toNumber(split.amount);
    const cur = curOfSplit(split);
    for (const path of paths) {
      const entry = stats.get(path) ?? emptyStats();
      const seen = groups.get(path) ?? new Set<string>();
      seen.add(group.id);
      groups.set(path, seen);
      entry.count = seen.size;
      if (split.type === "withdrawal") {
        add(entry.spent, cur, -amount);
      } else if (split.type === "deposit") {
        add(entry.earned, cur, amount);
      }
      stats.set(path, entry);
    }
  }
  return stats;
}

const normal = (value: string) =>
  value.normalize("NFKD").replace(DIACRITICS, "").toLowerCase();

export const squash = (value: string) => normal(value).replace(NOT_WORD, "");

function distance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, row) =>
    Array.from(
      { length: cols },
      (__, col) => Math.max(row, col) * (row * col === 0 ? 1 : 0)
    )
  );
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function variantOnly(a: string, b: string): boolean {
  const ta = normal(a).split(TOKEN);
  const tb = normal(b).split(TOKEN);
  if (ta.length !== tb.length) {
    return false;
  }
  const diff = ta.flatMap((token, i) =>
    token === tb[i] ? [] : [[token, tb[i]]]
  );
  if (diff.length !== 1) {
    return false;
  }
  const [x, y] = diff[0];
  return (
    (NUMERIC.test(x) && NUMERIC.test(y)) ||
    x.length <= SHORT_TOKEN ||
    y.length <= SHORT_TOKEN
  );
}

function near(a: string, b: string): boolean {
  const x = squash(a);
  const y = squash(b);
  if (x === y) {
    return true;
  }
  const length = Math.min(x.length, y.length);
  if (length < NEAR_ONE || variantOnly(a, b)) {
    return false;
  }
  const allowed = length >= NEAR_TWO ? 2 : 1;
  return Math.abs(x.length - y.length) <= allowed && distance(x, y) <= allowed;
}

export function duplicates(tags: Item<Tag>[]): Item<Tag>[][] {
  const parent = tags.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) {
      root = parent[root];
    }
    parent[i] = root;
    return root;
  };
  for (let i = 0; i < tags.length; i += 1) {
    for (let j = i + 1; j < tags.length; j += 1) {
      if (near(tags[i].attributes.tag, tags[j].attributes.tag)) {
        parent[find(j)] = find(i);
      }
    }
  }
  const clusters = new Map<number, Item<Tag>[]>();
  tags.forEach((tag, i) => {
    const root = find(i);
    clusters.set(root, [...(clusters.get(root) ?? []), tag]);
  });
  return [...clusters.values()].filter((cluster) => cluster.length > 1);
}
