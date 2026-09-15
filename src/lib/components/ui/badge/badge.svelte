<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const badgeVariants = tv({
		base: "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] [&>svg]:pointer-events-none [&>svg]:size-3",
		variants: {
			variant: {
				default: "border-border bg-surface-hover text-ink-mid",
				accent: "border-orange/40 bg-orange/10 text-orange",
				green: "border-green/40 bg-green/10 text-green",
				red: "border-red/40 bg-red/10 text-red",
				amber: "border-amber/40 bg-amber/10 text-amber",
				outline: "border-border text-ink-mid"
			}
		},
		defaultVariants: {
			variant: "default"
		}
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? "a" : "span"}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
