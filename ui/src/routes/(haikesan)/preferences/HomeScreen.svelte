<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import { createQuery } from "@tanstack/svelte-query";
  import { invalidate, lists } from "#lib/api/lists.js";
  import type { Account, Item } from "#lib/api/types.js";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import ListTable from "#lib/components/misc/ListTable.svelte";
  import { td, th } from "#lib/components/misc/styles.js";
  import Button from "#lib/components/ui/button/button.svelte";
  import { ListNav } from "#lib/list-nav.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import Section from "./Section.svelte";

  const ROLES: Record<string, string> = {
    cashWalletAsset: "Cash wallet",
    ccAsset: "Credit card",
    defaultAsset: "Default asset account",
    savingAsset: "Savings account",
    sharedAsset: "Shared asset account",
  };
  const LIABILITIES: Record<string, string> = {
    debt: "Debt",
    loan: "Loan",
    mortgage: "Mortgage",
  };

  const assets = createQuery(() => lists.accounts("asset"));
  const liabilities = createQuery(() => lists.accounts("liabilities"));
  const accounts = $derived(
    [...(assets.data ?? []), ...(liabilities.data ?? [])].filter(
      (a) => a.attributes.active !== false
    )
  );
  const byId = $derived(new Map(accounts.map((a) => [a.id, a])));

  let chosen = $derived.by(() => {
    if (!(assets.data && liabilities.data)) {
      return null;
    }
    const saved = session.frontpageAccounts.filter((id) => byId.has(id));
    return saved.length > 0 ? saved : accounts.map((a) => a.id);
  });

  const rows = $derived.by(() => {
    const picked = chosen ?? [];
    const first = picked
      .map((id) => byId.get(id))
      .filter((a) => a !== undefined);
    const rest = accounts
      .filter((a) => !picked.includes(a.id))
      .sort((a, b) => a.attributes.name.localeCompare(b.attributes.name));
    return [...first, ...rest];
  });

  const kind = (account: Account) =>
    account.type === "asset"
      ? (ROLES[account.account_role ?? ""] ?? "Asset account")
      : (LIABILITIES[account.liability_type ?? ""] ?? "Liability");

  function toggle(item: Item<Account> | undefined) {
    if (!(item && chosen)) {
      return;
    }
    chosen = chosen.includes(item.id)
      ? chosen.filter((id) => id !== item.id)
      : [...chosen, item.id];
    nav.cursor = rows.indexOf(item);
  }

  function move(item: Item<Account> | undefined, delta: number) {
    if (!(item && chosen)) {
      return;
    }
    const from = chosen.indexOf(item.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= chosen.length) {
      return;
    }
    const next = [...chosen];
    [next[from], next[to]] = [next[to], next[from]];
    chosen = next;
    nav.move(to);
  }

  const action = new Action();

  function save() {
    return action.run(async () => {
      if (!chosen?.length) {
        throw new Error("Pick at least one account");
      }
      await session.setPreference("frontpageAccounts", chosen.map(Number));
      await invalidate();
    });
  }

  const nav: ListNav<Item<Account>> = new ListNav({
    extra: () => [
      {
        group: "Home screen accounts",
        keys: "x",
        label: "Show or hide account on the home screen",
        run: () => toggle(nav.current),
      },
      {
        group: "Home screen accounts",
        hidden: true,
        keys: "Space",
        label: "Show or hide account on the home screen",
        run: () => toggle(nav.current),
      },
      {
        group: "Home screen accounts",
        keys: "K",
        label: "Move account up",
        run: () => move(nav.current, -1),
      },
      {
        group: "Home screen accounts",
        keys: "J",
        label: "Move account down",
        run: () => move(nav.current, 1),
      },
      {
        group: "Home screen accounts",
        input: true,
        keys: "mod+s",
        label: "Save home screen accounts",
        run: save,
      },
    ],
    id: "frontpage",
    items: () => rows,
    key: (item) => item.id,
  });
  nav.use();
</script>

<div class="max-w-3xl">
  <Section
    {action}
    help="Which accounts should be displayed on the home page, and in what order? Use x to pick, Shift+J and Shift+K to move."
    onsave={save}
    title="Home screen accounts"
  >
    <div class="-mx-3">
      <ListTable key={(item) => item.id} {nav}>
        {#snippet head()}
          <th class="{th} w-10"></th>
          <th class="{th} w-10 text-right">#</th>
          <th class={th}>Account</th>
          <th class="{th} hidden sm:table-cell">Type</th>
          <th class="{th} w-20"></th>
        {/snippet}
        {#snippet row(
          item
        )}
          {@const position = chosen?.indexOf(item.id) ?? -1}
          <td class="{td} text-center">
            <input
              aria-label="Show {item.attributes.name} on the home screen"
              checked={position >= 0}
              class="size-3.5 accent-brand align-middle"
              onchange={() => toggle(item)}
              type="checkbox"
            >
          </td>
          <td class="{td} num text-right text-cladd-fg-soft">
            {position >= 0 ? position + 1 : ""}
          </td>
          <td class="{td} {position >= 0 ? "" : "text-cladd-fg-soft"}">
            {item.attributes.name}
          </td>
          <td class="{td} hidden sm:table-cell text-cladd-fg-soft">
            {kind(item.attributes)}
          </td>
          <td class="{td} whitespace-nowrap">
            {#if position >= 0}
              <Button
                aria-label="Move up"
                disabled={position === 0}
                onclick={() => move(item, -1)}
                size="icon-xs"
                variant="ghost"
                ><ArrowUp /></Button
              >
              <Button
                aria-label="Move down"
                disabled={position === (chosen?.length ?? 0) - 1}
                onclick={() => move(item, 1)}
                size="icon-xs"
                variant="ghost"
                ><ArrowDown /></Button
              >
            {/if}
          </td>
        {/snippet}
      </ListTable>
    </div>
  </Section>
</div>
