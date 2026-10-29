import { api } from "#lib/api/client.js";
import { all } from "#lib/api/lists.js";
import type {
  Item,
  Page,
  Split,
  Tag,
  TransactionGroup,
} from "#lib/api/types.js";
import {
  type Outcome,
  type Patch,
  type Targets,
  updateGroups,
} from "#lib/transactions/mass.js";

export interface Usage {
  counts: Map<string, number>;
  samples: Map<string, Item<TransactionGroup>>;
}

const lower = (tag: Item<Tag>) => tag.attributes.tag.toLowerCase();

const tagged = (groups: Item<TransactionGroup>[], name: string) =>
  groups.filter((group) =>
    group.attributes.transactions.some((split) => split.tags?.includes(name))
  );

export async function renameTag(tag: Item<Tag>, next: string) {
  await api(`/v1/tags/${tag.id}`, { body: { tag: next }, method: "PUT" });
}

export async function deleteTag(tag: Item<Tag>) {
  await api(`/v1/tags/${tag.id}`, { method: "DELETE" });
}

export async function mergeTag(
  from: Item<Tag>,
  into: string,
  progress: (outcome: Outcome) => void
): Promise<Outcome> {
  let name = from.attributes.tag;
  if (name === into) {
    return { done: 0, errors: [], total: 0 };
  }
  if (name.toLowerCase() === into.toLowerCase()) {
    name = `${name} (merging into ${into})`;
    await renameTag(from, name);
  }
  const groups = tagged(
    await all<TransactionGroup>(`/v1/tags/${from.id}/transactions`, {
      type: "all",
    }),
    name
  );
  const targets: Targets = new Map(groups.map((group) => [group.id, null]));
  const outcome = await updateGroups(
    targets,
    (split) => {
      const tags = split.tags ?? [];
      if (!tags.includes(name)) {
        return null;
      }
      return {
        tags: [...new Set([...tags.filter((tag) => tag !== name), into])],
      };
    },
    progress
  );
  if (outcome.errors.length === 0) {
    await deleteTag(from);
  }
  return outcome;
}

export async function convertTag(
  tag: Item<Tag>,
  patch: (split: Split) => Patch | null,
  progress: (outcome: Outcome) => void
): Promise<{ outcome: Outcome; splits: Split[] }> {
  const name = tag.attributes.tag;
  const groups = tagged(
    await all<TransactionGroup>(`/v1/tags/${tag.id}/transactions`, {
      type: "all",
    }),
    name
  );
  const has = (split: Split) => split.tags?.includes(name) ?? false;
  const outcome = await updateGroups(
    new Map(groups.map((group) => [group.id, null])),
    (split) => (has(split) ? patch(split) : null),
    progress
  );
  const splits = groups.flatMap((group) =>
    group.attributes.transactions.filter(has)
  );
  return { outcome, splits };
}

export async function usage(tags: Item<Tag>[]): Promise<Usage> {
  const keys = tags.map(lower);
  const clash = new Set(keys.filter((key, i) => keys.indexOf(key) !== i));
  const plain = tags.filter((tag) => !clash.has(lower(tag)));
  const pages = await Promise.all(
    plain.map((tag) =>
      api<Page<TransactionGroup>>(`/v1/tags/${tag.id}/transactions`, {
        query: { limit: 1, type: "all" },
      })
    )
  );
  const counts = new Map(
    plain.map((tag, i) => [tag.id, pages[i].meta.pagination?.total ?? 0])
  );
  const samples = new Map(
    plain.flatMap((tag, i) =>
      pages[i].data[0] ? [[tag.id, pages[i].data[0]] as const] : []
    )
  );
  await Promise.all(
    [...clash].map(async (key) => {
      const variants = tags.filter((tag) => lower(tag) === key);
      const groups = await all<TransactionGroup>(
        `/v1/tags/${variants[0].id}/transactions`,
        { type: "all" }
      );
      for (const variant of variants) {
        const own = tagged(groups, variant.attributes.tag);
        counts.set(variant.id, own.length);
        if (own[0]) {
          samples.set(variant.id, own[0]);
        }
      }
    })
  );
  return { counts, samples };
}

export function sequence<T>(items: T[], run: (item: T) => Promise<void>) {
  return items.reduce<Promise<void>>(
    (previous, item) => previous.then(() => run(item)),
    Promise.resolve()
  );
}
