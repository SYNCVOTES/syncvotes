<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	/** A band of the landing: edge padding, generous vertical room, a hairline above if asked. */
	let {
		id,
		rule = false,
		class: className = '',
		children
	}: { id?: string; rule?: boolean; class?: string; children: Snippet } = $props();
</script>

<section
	{id}
	class={cn('px-edge pt-[120px] pb-[140px]', rule && 'border-t border-border', className)}
>
	{@render children()}
</section>
