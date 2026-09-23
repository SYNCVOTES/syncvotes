<script lang="ts">
	import { store } from '$lib/wallet-store.svelte';
	import Loader from '@lucide/svelte/icons/loader';

	/**
	 * The one place that always says when the key or the ledger is at work: a pill in the corner
	 * with the step under way, the seconds it has taken once they add up, and a word of patience
	 * when the network is slow. Every action goes through the store, so it needs nothing from the
	 * pages.
	 */
	let started = $state<number | null>(null);
	let elapsed = $state(0);
	$effect(() => {
		if (!store.busy) {
			started = null;
			elapsed = 0;
			return;
		}
		started = Date.now();
		const t = setInterval(() => (elapsed = Math.round((Date.now() - started!) / 1000)), 500);
		return () => clearInterval(t);
	});
</script>

{#if store.busy}
	<div
		class="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 border-2 border-orange bg-surface px-5 py-3.5 shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.15),0_12px_32px_rgba(0,0,0,0.35)]"
		role="status"
		aria-live="polite"
	>
		<Loader size={18} class="shrink-0 animate-spin text-orange" aria-hidden="true" />
		<div class="min-w-0 font-mono text-xs">
			<div class="font-bold text-ink">{store.phase ?? 'Working'}…</div>
			{#if elapsed >= 4}
				<div class="mt-0.5 text-ink-dim">
					{elapsed}s{elapsed >= 12
						? ' · the network is taking its time; nothing to do but wait'
						: ''}
				</div>
			{/if}
		</div>
	</div>
{/if}
