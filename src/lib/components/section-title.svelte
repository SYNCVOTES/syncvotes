<script lang="ts">
	/** The mono eyebrow that opens a block, with an optional count on the right. */
	let { title, count }: { title: string; count?: string | number } = $props();
</script>

<div class="mb-4 flex items-center justify-between">
	<h2 class="eyebrow">{title}</h2>
	{#if count !== undefined}<span class="font-mono text-xs text-ink-dim">{count}</span>{/if}
</div>
