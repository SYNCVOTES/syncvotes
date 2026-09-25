<script lang="ts">
	import { flow, describe, transient, store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Problem from './problem.svelte';
	import PartyId from './party-id.svelte';
	import StateMessage from './state-message.svelte';
	import Lock from '@lucide/svelte/icons/lock';
	import SearchX from '@lucide/svelte/icons/search-x';

	/**
	 * What a page shows when a live query failed. A lost read session (401) while the key is
	 * still unlocked is re-signed and the query refreshed, once; the server being away (a
	 * deploy, a dropped connection) is retried every few seconds until it is back. Members
	 * only (403) and not found (404) are states, not failures; anything else is said as is.
	 */
	let {
		error,
		refresh,
		back = { href: '/my-daos', label: 'Back to My DAOs' }
	}: {
		error: unknown;
		refresh: () => unknown;
		/** Where the way out of a members-only or missing page leads. */
		back?: { href: string; label: string };
	} = $props();

	let reconnecting = $state(false);
	let gaveUp = $state(false);
	const status = $derived((error as { status?: number })?.status);

	$effect(() => {
		if (status !== 401 || gaveUp || reconnecting) return;
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
{:else if status === 403 && store.who && /^Only members/.test(describe(error))}
	<StateMessage icon={Lock} title="Members only">
		{describe(error)}. To join, share your party ID with a member:
		<span class="mt-2 flex justify-center"><PartyId party={store.who.party} /></span>
		{#snippet actions()}<Button href={back.href} variant="outline">{back.label}</Button>{/snippet}
	</StateMessage>
{:else if status === 404}
	<StateMessage icon={SearchX} title={describe(error)}>
		Check the link, or find it from your list.
		{#snippet actions()}<Button href={back.href} variant="outline">{back.label}</Button>{/snippet}
	</StateMessage>
{:else}
	<Problem message={describe(error)} />
{/if}
