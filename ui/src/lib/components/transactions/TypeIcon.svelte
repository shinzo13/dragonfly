<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Calculator from "@lucide/svelte/icons/calculator";
  import Star from "@lucide/svelte/icons/star";
  import { TYPE_LABEL } from "#lib/transactions/split.js";

  let { type, class: className = "" }: { type: string; class?: string } =
    $props();

  const icons = {
    deposit: ArrowRight,
    reconciliation: Calculator,
    transfer: ArrowLeftRight,
    withdrawal: ArrowLeft,
  };
  const Icon = $derived(icons[type as keyof typeof icons] ?? Star);
</script>

<Icon
  aria-label={TYPE_LABEL[type] ?? type}
  class="size-3.5 shrink-0 text-cladd-fg-softer {className}"
  role="img"
>
  <title>{TYPE_LABEL[type] ?? type}</title>
</Icon>
