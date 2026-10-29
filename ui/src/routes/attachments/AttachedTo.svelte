<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { api } from "#lib/api/client.js";
  import type { One, TransactionGroup } from "#lib/api/types.js";
  import { link } from "#lib/components/misc/styles.js";

  interface Target {
    href: string;
    path: string;
    title: string;
  }

  type Named = Record<string, unknown>;

  let { type, id }: { type?: string | null; id?: string | null } = $props();

  const TARGETS: Record<string, Target> = {
    Account: { href: "/accounts/show/", path: "/v1/accounts/", title: "name" },
    Bill: { href: "/subscriptions/show/", path: "/v1/bills/", title: "name" },
    Budget: { href: "/budgets/show/", path: "/v1/budgets/", title: "name" },
    Category: {
      href: "/categories/show/",
      path: "/v1/categories/",
      title: "name",
    },
    PiggyBank: {
      href: "/piggy-banks/show/",
      path: "/v1/piggy-banks/",
      title: "name",
    },
    Recurrence: {
      href: "/recurring/show/",
      path: "/v1/recurrences/",
      title: "title",
    },
    Tag: { href: "/tags/show/", path: "/v1/tags/", title: "tag" },
  };

  async function resolve(): Promise<{ href: string; label: string }> {
    if (type === "TransactionJournal") {
      const group = await api<One<TransactionGroup>>(
        `/v1/transaction-journals/${id}`
      );
      const split = group.data.attributes.transactions.find(
        (s) => s.transaction_journal_id === id
      );
      return {
        href: `/transactions/show/${group.data.id}`,
        label:
          split?.description ?? group.data.attributes.group_title ?? `#${id}`,
      };
    }
    const target = TARGETS[type ?? ""];
    const body = await api<One<Named>>(`${target.path}${id}`);
    return {
      href: `${target.href}${id}`,
      label: String(body.data.attributes[target.title] ?? `#${id}`),
    };
  }

  const known = $derived(
    type === "TransactionJournal" || Boolean(TARGETS[type ?? ""])
  );
  const query = createQuery(() => ({
    enabled: known && Boolean(id),
    queryFn: resolve,
    queryKey: ["attachable", type, id],
  }));
</script>

{#if query.data}
  <a class={link} href={query.data.href}>{query.data.label}</a>
{:else if query.error || !known}
  <span class="text-cladd-fg-soft">{type} #{id}</span>
{/if}
