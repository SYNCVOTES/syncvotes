<script lang="ts">
	import type { Snippet } from 'svelte';
	import Panel from './panel.svelte';

	/** Where a list would be if there were anything in it. */
	let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<Panel variant="dashed" class="px-6 py-12 text-center">
	{#if title}<p class="font-display text-[17px] font-bold">{title}</p>{/if}
	<div class="text-[13px] text-ink-dim {title ? 'mt-2' : ''}">{@render children()}</div>
</Panel>
