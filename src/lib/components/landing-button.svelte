<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { cn } from '$lib/utils.js';

	/** The landing's pill: solid orange, or a ghost outline. With `arrow`, an arrow after the text. */
	let {
		href,
		variant = 'primary',
		arrow = false,
		class: className = '',
		children
	}: {
		href: string;
		variant?: 'primary' | 'ghost';
		arrow?: boolean;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<a
	{href}
	class={cn(
		'inline-flex items-center gap-2.5 rounded-full border px-7 py-4 font-mono text-sm font-bold tracking-[0.1em] uppercase transition-transform hover:-translate-y-0.5 max-sm:px-[22px] max-sm:py-3.5 max-sm:text-[13px] max-sm:whitespace-nowrap',
		variant === 'primary'
			? 'border-orange bg-orange text-background'
			: 'border-border-hover bg-transparent text-ink hover:border-ink',
		className
	)}
>
	{@render children()}
	{#if arrow}<ArrowRight size={16} strokeWidth={2.5} />{/if}
</a>
