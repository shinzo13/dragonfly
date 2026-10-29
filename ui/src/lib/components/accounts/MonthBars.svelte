<script lang="ts">
  import type { Month } from "#lib/accounts/ledger.js";
  import { currentLocale } from "#lib/format.js";

  let {
    months,
    format,
  }: {
    months: Month[];
    format: (value: number) => string;
  } = $props();

  const max = $derived(
    Math.max(1, ...months.flatMap((m) => [m.sent, m.received]))
  );
  const letter = (month: string) =>
    new Date(`${month}-15T12:00:00`).toLocaleDateString(currentLocale(), {
      month: "narrow",
    });
  const name = (month: string) =>
    new Date(`${month}-15T12:00:00`).toLocaleDateString(currentLocale(), {
      month: "short",
      year: "numeric",
    });
  const height = (value: number) =>
    value > 0 ? `max(2px, ${(value / max) * 100}%)` : "0";
  const title = (m: Month) =>
    `${name(m.month)}: received ${format(m.received)}, sent ${format(m.sent)}`;
</script>

<div
  aria-label="Received and sent per month"
  class="grid grid-cols-12 gap-x-1"
  role="img"
>
  {#each months as m (m.month)}
    <div class="flex h-8 items-end" title={title(m)}>
      <div
        class="w-full rounded-t-[2px] bg-income"
        style:height={height(m.received)}
      ></div>
    </div>
  {/each}
  <div class="col-span-12 h-px bg-cladd-outline"></div>
  {#each months as m (m.month)}
    <div class="flex h-8 items-start" title={title(m)}>
      <div
        class="w-full rounded-b-[2px] bg-expense"
        style:height={height(m.sent)}
      ></div>
    </div>
  {/each}
  {#each months as m (m.month)}
    <span class="pt-0.5 text-center text-[10px] text-cladd-fg-softer"
      >{letter(m.month)}</span
    >
  {/each}
</div>
