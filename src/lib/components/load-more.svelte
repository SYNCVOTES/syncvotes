<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	/** "Showing 50 of 2,000 — Load more". Pages of a list that may be very long. */
	let {
		shown,
		total,
		noun,
		onmore
	}: { shown: number; total: number; noun: string; onmore: () => void } = $props();
	const fmt = (n: number) => n.toLocaleString('en-US');
</script>

<div class="mt-4 flex items-center justify-between gap-4 font-mono text-xs text-ink-dim">
	<span>Showing {fmt(Math.min(shown, total))} of {fmt(total)} {noun}</span>
	{#if shown < total}
		<Button variant="outline" size="sm" onclick={onmore}>Load more</Button>
	{/if}
</div>
