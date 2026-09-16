<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	/** Three cards on a hairline grid; the page's observer adds `in` and they rise in turn. */
	let { class: className = '', children }: { class?: string; children: Snippet } = $props();
</script>

<div
	class={cn(
		'group/grid grid grid-cols-3 gap-px border border-border bg-border max-[900px]:grid-cols-1',
		className
	)}
>
	{@render children()}
</div>
