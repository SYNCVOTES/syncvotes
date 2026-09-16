<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	/** Rows on a surface, hairlines between them. */
	let { class: className = '', children }: { class?: string; children: Snippet } = $props();
</script>

<ul class={cn('divide-y divide-border border border-border bg-surface', className)}>
	{@render children()}
</ul>
