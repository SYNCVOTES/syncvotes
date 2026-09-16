<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	/** One row. With `href` the whole row is the link and lights up on hover. */
	let {
		href,
		padding = 'sm',
		class: className = '',
		children
	}: { href?: string; padding?: 'sm' | 'md'; class?: string; children: Snippet } = $props();

	const paddings = { sm: 'px-4 py-3', md: 'px-5 py-4' };
</script>

<li>
	{#if href}
		<a
			{href}
			class={cn(
				'group flex items-center gap-4 transition-colors hover:bg-surface-hover',
				paddings[padding],
				className
			)}
		>
			{@render children()}
		</a>
	{:else}
		<div class={cn(paddings[padding], className)}>{@render children()}</div>
	{/if}
</li>
