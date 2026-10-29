<script lang="ts">
  import type { Kind } from "#lib/accounts/merchants.js";
  import { useMerchants } from "#lib/accounts/merchants.svelte.js";
  import Box from "#lib/components/Box.svelte";
  import { indexUrl } from "./links.js";
  import MerchantCell, { type Column } from "./MerchantCell.svelte";

  const COLUMNS: Column[] = ["name", "month", "share", "change"];

  let { kind, limit = 8 }: { kind: Kind; limit?: number } = $props();

  const data = useMerchants(() => kind);
  const all = $derived(data.board?.merchants ?? []);
  const top = $derived(all.filter((m) => !m.quiet).slice(0, limit));
  const href = $derived(indexUrl(kind));
</script>

<Box
  body="p-0"
  {href}
  title={kind === "expense" ? "Where it went" : "Where it came from"}
>
  {#if data.error}
    <p class="p-3 text-expense">{data.error.message}</p>
  {:else if data.board && top.length > 0}
    <table class="w-full border-collapse text-[13px]">
      <thead class="sr-only">
        <tr>
          <th scope="col">{kind === "expense" ? "Merchant" : "Payer"}</th>
          <th scope="col">This period</th>
          <th scope="col">Share</th>
          <th scope="col">vs typical</th>
        </tr>
      </thead>
      <tbody>
        {#each top as m (m.id)}
          <tr
            class="border-cladd-outline/60 border-t align-top first:border-t-0"
          >
            {#each COLUMNS as col (col)}
              <td
                class="h-7 whitespace-nowrap px-2 py-1 sm:px-3 {col === "name"
                  ? ""
                  : "text-right"} {col === "share"
                  ? "hidden sm:table-cell"
                  : ""}"
              >
                <MerchantCell
                  {col}
                  compare={data.day !== null}
                  {kind}
                  max={top[0]?.share ?? 0}
                  merchant={m}
                  past={data.board.past}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if data.board}
    <p class="p-3 text-cladd-fg-soft">Nothing in this period.</p>
  {:else}
    <div class="h-40"></div>
  {/if}
  {#snippet footer()}
    <a class="text-brand dark:text-(--ff-series-1) hover:underline" {href}
      >See all {all.length}</a
    >
  {/snippet}
</Box>
