<script lang="ts">
  import type {
    HTMLInputAttributes,
    HTMLInputTypeAttribute,
  } from "svelte/elements";
  import { cn, type WithElementRef } from "#lib/utils.js";

  type InputType = Exclude<HTMLInputTypeAttribute, "file">;

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, "type"> &
      (
        | { type: "file"; files?: FileList }
        | { type?: InputType; files?: undefined }
      )
  >;

  let {
    ref = $bindable(null),
    value = $bindable(),
    type,
    files = $bindable(),
    class: className,
    "data-slot": dataSlot = "input",
    ...restProps
  }: Props = $props();
</script>

{#if type === "file"}
  <input
    bind:this={ref}
    data-slot={dataSlot}
    class={cn(
      "cladd-cut cladd-hoverable cladd-focusable-input flex h-cladd-md w-full min-w-0 rounded-cladd-md px-2.5 pt-1.5 font-medium text-cladd-fg text-cladd-xs selection:bg-brand/30 file:me-2 file:font-semibold file:text-cladd-fg placeholder:text-cladd-fg-softer disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    type="file"
    bind:files
    bind:value
    {...restProps}
  >
{:else}
  <input
    bind:this={ref}
    data-slot={dataSlot}
    class={cn(
      "cladd-cut cladd-hoverable cladd-focusable-input flex h-cladd-md w-full min-w-0 rounded-cladd-md px-2.5 py-1 font-medium text-cladd-fg text-cladd-xs selection:bg-brand/30 placeholder:text-cladd-fg-softer disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {type}
    bind:value
    {...restProps}
  >
{/if}
