<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	/**
	 * "Showing 50 of 2,000 — Load more · Show all". Pages of a list that may be very long: each
	 * step is as big as what is shown already, so a thousand is four clicks, not fifty; and
	 * where the rest is not too much, one click shows it all.
	 */
	let {
		shown,
		total,
		noun,
		onmore,
		all = 1000
	}: {
		shown: number;
		total: number;
		noun: string;
		/** Called with how many to show next. */
		onmore: (next: number) => void;
		/** Up to this many, "Show all" is offered. */
		all?: number;
	} = $props();
	const fmt = (n: number) => n.toLocaleString('en-US');
	const step = $derived(Math.max(50, shown));
</script>

<div class="mt-4 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-ink-dim">
	<span>Showing {fmt(Math.min(shown, total))} of {fmt(total)} {noun}</span>
	{#if shown < total}
		<span class="flex gap-2">
			<Button variant="outline" size="sm" onclick={() => onmore(Math.min(total, shown + step))}
				>Load more</Button
			>
			{#if total <= all && total > shown + step}
				<Button variant="ghost" size="sm" onclick={() => onmore(total)}
					>Show all {fmt(total)}</Button
				>
			{/if}
		</span>
	{/if}
</div>
