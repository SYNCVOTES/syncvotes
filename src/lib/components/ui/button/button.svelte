<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	export const buttonVariants = tv({
		// v1: every button is a pill of mono uppercase text; the accent is the one colour.
		base: "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border font-mono text-xs uppercase tracking-[0.14em] transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/85',
				outline:
					'border-border bg-transparent text-ink hover:border-border-hover hover:bg-surface-hover',
				accent: 'border-orange/40 bg-orange/5 text-orange hover:bg-orange/10',
				amber: 'border-amber/40 bg-amber/5 text-amber hover:bg-amber/10',
				ghost: 'border-transparent text-ink-mid hover:bg-surface-hover hover:text-ink',
				// Yes on a ballot: green, the colour it fills the tally with.
				yes: 'border-green/40 bg-green/5 text-green hover:bg-green/10',
				destructive: 'border-red/40 bg-red/5 text-red hover:bg-red/10',
				link: 'border-transparent text-ink-mid normal-case tracking-normal underline-offset-4 hover:text-orange hover:underline'
			},
			size: {
				default: 'h-10 px-6',
				sm: 'h-8 px-4 text-label',
				lg: 'h-12 px-8',
				icon: 'size-[34px] rounded-full',
				'icon-sm': 'size-7 rounded-full'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
