<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	/** A bordered surface. Dashed when it stands for something that is not there yet. */
	let {
		padding = 'md',
		variant = 'solid',
		class: className = '',
		children
	}: {
		padding?: 'sm' | 'md' | 'lg';
		variant?: 'solid' | 'dashed' | 'danger';
		class?: string;
		children: Snippet;
	} = $props();

	// One padding for content; `lg` is for empty and dashed states. `sm` is kept as an alias.
	const paddings = { sm: 'p-5 md:p-6', md: 'p-5 md:p-6', lg: 'p-8' };
	const variants = {
		solid: 'border-border bg-surface',
		dashed: 'border-dashed border-border',
		danger: 'border-red/30 bg-red/[0.04]'
	};
</script>

<div class={cn('border', variants[variant], paddings[padding], className)}>
	{@render children()}
</div>
