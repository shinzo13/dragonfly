<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import MerchantsTop from "#lib/components/accounts/MerchantsTop.svelte";
  import AccountsBlock from "#lib/components/dashboard/AccountsBlock.svelte";
  import AccountsChart from "#lib/components/dashboard/AccountsChart.svelte";
  import BudgetsChart from "#lib/components/dashboard/BudgetsChart.svelte";
  import CategoriesChart from "#lib/components/dashboard/CategoriesChart.svelte";
  import DebtsBox from "#lib/components/dashboard/DebtsBox.svelte";
  import DueBox from "#lib/components/dashboard/DueBox.svelte";
  import { accountsQuery } from "#lib/components/dashboard/data.js";
  import InboxBox from "#lib/components/dashboard/InboxBox.svelte";
  import InfoBoxes from "#lib/components/dashboard/InfoBoxes.svelte";
  import PaceBox from "#lib/components/dashboard/PaceBox.svelte";
  import PiggyBanksBox from "#lib/components/dashboard/PiggyBanksBox.svelte";
  import SubscriptionsBox from "#lib/components/dashboard/SubscriptionsBox.svelte";
  import PageHeader from "#lib/components/shell/PageHeader.svelte";
  import { provideColumn } from "#lib/dashboard/column.svelte.js";
  import { period } from "#lib/period.svelte.js";

  provideColumn();

  const assets = createQuery(() =>
    accountsQuery("asset", period.start, period.end)
  );

  $effect(() => {
    if (assets.isSuccess && assets.data.length === 0) {
      location.assign("/new-user");
    }
  });
</script>

<PageHeader subtitle="What's playing?" title="Dashboard" />

<InfoBoxes />

<div
  class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,36%)] xl:grid-rows-[auto_1fr]"
>
  <PaceBox class="xl:col-start-1" />
  <div
    class="flex min-w-0 flex-col gap-3 xl:col-start-2 xl:row-span-2 xl:row-start-1"
  >
    <AccountsBlock />
    <InboxBox />
    <DueBox />
    <DebtsBox />
    <SubscriptionsBox />
    <PiggyBanksBox />
  </div>
  <div class="flex min-w-0 flex-col gap-3 self-start xl:col-start-1">
    <AccountsChart />
    <BudgetsChart />
    <CategoriesChart />
    <div class="grid gap-3 2xl:grid-cols-2">
      <MerchantsTop kind="expense" />
      <MerchantsTop kind="revenue" />
    </div>
  </div>
</div>
