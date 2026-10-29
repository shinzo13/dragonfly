<script lang="ts">
  import { formatDate } from "#lib/format.js";
  import type { Flow } from "#lib/reports/flows.js";
  import { money } from "#lib/reports/report.svelte.js";

  let {
    flows,
    columns = ["date", "description", "account", "other", "category", "budget"],
  }: {
    flows: Flow[];
    columns?: string[];
  } = $props();

  const has = (name: string) => columns.includes(name);
</script>

<div class="overflow-x-auto">
  <table class="w-full border-collapse text-[13px]">
    <thead>
      <tr class="text-left text-[12px] text-cladd-fg-soft">
        {#if has("date")}
          <th class="h-7 px-3 font-medium">Date</th>
        {/if}
        <th class="h-7 px-3 font-medium">Description</th>
        {#if has("account")}
          <th class="h-7 px-3 font-medium max-md:hidden">Account</th>
        {/if}
        {#if has("other")}
          <th class="h-7 px-3 font-medium max-md:hidden">Counterparty</th>
        {/if}
        {#if has("category")}
          <th class="h-7 px-3 font-medium max-lg:hidden">Category</th>
        {/if}
        {#if has("budget")}
          <th class="h-7 px-3 font-medium max-lg:hidden">Budget</th>
        {/if}
        <th class="h-7 px-3 text-right font-medium">Amount</th>
      </tr>
    </thead>
    <tbody>
      {#each flows as flow (`${flow.journal}:${flow.dir}`)}
        <tr class="h-7 border-cladd-outline border-t hover:bg-row-hover">
          {#if has("date")}
            <td class="num whitespace-nowrap px-3 text-cladd-fg-soft">
              {formatDate(flow.date, "short")}
            </td>
          {/if}
          <td class="max-w-[22rem] truncate px-3">
            <a class="hover:underline" href="/transactions/show/{flow.group}"
              >{flow.description}</a
            >
          </td>
          {#if has("account")}
            <td
              class="max-w-[12rem] truncate px-3 text-cladd-fg-soft max-md:hidden"
            >
              {flow.asset.name}
            </td>
          {/if}
          {#if has("other")}
            <td class="max-w-[14rem] truncate px-3 max-md:hidden">
              <a class="hover:underline" href="/accounts/show/{flow.other.id}"
                >{flow.other.name}</a
              >
            </td>
          {/if}
          {#if has("category")}
            <td
              class="max-w-[10rem] truncate px-3 text-cladd-fg-soft max-lg:hidden"
            >
              {flow.category?.name ?? ""}
            </td>
          {/if}
          {#if has("budget")}
            <td
              class="max-w-[10rem] truncate px-3 text-cladd-fg-soft max-lg:hidden"
            >
              {flow.budget?.name ?? ""}
            </td>
          {/if}
          <td
            class="num whitespace-nowrap px-3 text-right {flow.dir === 1
              ? "text-income"
              : "text-expense"}"
          >
            {money(flow.currency, flow.dir * flow.amount)}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
