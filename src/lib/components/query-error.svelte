<script lang="ts">
	import { flow, describe, transient } from '$lib/wallet-store.svelte';
	import Problem from './problem.svelte';

	/**
	 * What a page shows when a live query failed. A lost read session (401) while the key is
	 * still unlocked is re-signed and the query refreshed, once; the server being away (a
	 * deploy, a dropped connection) is retried every few seconds until it is back; anything
	 * else is said as is.
	 */
	let { error, refresh }: { error: unknown; refresh: () => unknown } = $props();

	let reconnecting = $state(false);
	let gaveUp = $state(false);

	$effect(() => {
		if ((error as { status?: number })?.status !== 401 || gaveUp || reconnecting) return;
		reconnecting = true;
		flow.reconnect().then(async (ok) => {
			if (ok) await refresh();
			else gaveUp = true;
			reconnecting = false;
		});
	});

	// The component goes away with the error once a retry succeeds; until then, keep trying.
	$effect(() => {
		if (!transient(error)) return;
		const timer = setInterval(() => void refresh(), 4000);
		return () => clearInterval(timer);
	});
</script>

{#if reconnecting || transient(error)}
	<p class="flex items-center gap-2 font-mono text-xs text-ink-dim">
		<span class="size-2 animate-pulse rounded-full bg-amber"></span>
		{transient(error) ? 'The app is being updated; reconnecting…' : 'Reconnecting…'}
	</p>
{:else}
	<Problem message={describe(error)} />
{/if}
