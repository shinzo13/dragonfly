<script lang="ts">
  let {
    value = $bindable(),
    options,
  }: { value: string; options: { id: string; label: string }[] } = $props();
</script>

<div class="seg" role="radiogroup">
  {#each options as o (o.id)}
    <button aria-checked={value === o.id} class:on={value === o.id} onclick={() => (value = o.id)} role="radio" type="button">{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    display: flex;
    padding: 3px;
    border-radius: 11px;
    background: var(--sunk);
  }
  button {
    flex: 1;
    height: 34px;
    border: 0;
    border-radius: 8px;
    background: none;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--mute);
    cursor: pointer;
    white-space: nowrap;
  }
  button.on {
    background: var(--panel);
    color: var(--ink);
    box-shadow: 0 1px 3px #0000001f;
  }
</style>
