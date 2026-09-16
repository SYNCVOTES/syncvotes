<script lang="ts">
	import { flow, describe } from '$lib/wallet-store.svelte';
	import Problem from './problem.svelte';

	/**
	 * What a page shows when a live query failed. A lost read session (401) while the key is
	 * still unlocked is re-signed and the query refreshed, once; anything else is said as is.
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
</script>

{#if reconnecting}
	<p class="font-mono text-xs text-ink-dim">Reconnecting…</p>
{:else}
	<Problem message={describe(error)} />
{/if}
