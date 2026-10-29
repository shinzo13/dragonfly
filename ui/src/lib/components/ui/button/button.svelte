<script lang="ts" module>
  import { cn, type WithElementRef } from "#lib/utils.js";
  import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";
  import { type VariantProps, tv } from "tailwind-variants";

  export type CladdColor =
    | "neutral"
    | "brand"
    | "red"
    | "pink"
    | "purple"
    | "blue"
    | "cyan"
    | "lime"
    | "green"
    | "yellow"
    | "orange";

  export const buttonVariants = tv({
    base: "cladd-clickable cladd-focusable relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap font-semibold disabled:pointer-events-none disabled:*:opacity-40 aria-disabled:pointer-events-none aria-disabled:*:opacity-40 aria-invalid:outline-destructive [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    variants: {
      variant: {
        default:
          "cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-color-brand text-cladd-primary",
        destructive:
          "cladd-surface cladd-gradient cladd-outline cladd-hoverable cladd-color-red text-cladd-primary",
        outline:
          "cladd-surface cladd-gradient cladd-outline cladd-hoverable text-cladd-fg",
        secondary: "cladd-surface cladd-gradient cladd-hoverable text-cladd-fg",
        ghost: "cladd-ghost cladd-hoverable text-cladd-fg",
        fill: "cladd-surface cladd-gradient-fill cladd-outline cladd-hoverable",
        link: "cladd-color-brand text-cladd-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-cladd-md rounded-cladd-md px-2.5 text-cladd-xs",
        xs: "h-cladd-xs gap-1.5 rounded-cladd-xs px-2 text-cladd-xs [&_svg:not([class*=size-])]:size-3",
        sm: "h-cladd-sm gap-1.5 rounded-cladd-sm px-2.5 text-cladd-xs",
        lg: "h-cladd-lg rounded-cladd-lg px-3 text-cladd-xs",
        xl: "h-cladd-xl rounded-cladd-xl px-3.5 text-cladd-sm",
        icon: "size-cladd-md rounded-cladd-md",
        "icon-xs":
          "size-cladd-xs rounded-cladd-xs [&_svg:not([class*=size-])]:size-3",
        "icon-sm": "size-cladd-sm rounded-cladd-sm",
        "icon-lg": "size-cladd-lg rounded-cladd-lg",
      },
      rounded: {
        true: "rounded-full",
        false: "",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto rounded-none px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: false,
    },
  });

  /** Swaps the variant's accent for an explicit one: `<Button color="green">`. */
  export function withColor(classes: string, color?: CladdColor) {
    if (!color) {
      return classes;
    }
    return `${classes.replace(/\bcladd-color-\w+/g, "")} cladd-color-${color}`;
  }

  export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
  export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
      rounded?: boolean;
      color?: CladdColor;
    };
</script>

<script lang="ts">
  let {
    class: className,
    variant = "default",
    size = "default",
    rounded = false,
    color,
    ref = $bindable(null),
    href,
    type = "button",
    disabled,
    children,
    ...restProps
  }: ButtonProps = $props();

  const classes = $derived(
    cn(withColor(buttonVariants({ variant, size, rounded }), color), className)
  );
</script>

<!-- Content sits in its own box so the press can shrink it while the surface stays put. -->
{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    class={classes}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? "link" : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    <span data-slot="button-content" class="cladd-button-content"
      >{@render children?.()}</span
    >
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={classes}
    {type}
    {disabled}
    {...restProps}
  >
    <span data-slot="button-content" class="cladd-button-content"
      >{@render children?.()}</span
    >
  </button>
{/if}
