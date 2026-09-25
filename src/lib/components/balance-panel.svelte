<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Skeleton from './skeleton.svelte';
	import QueryError from './query-error.svelte';
	import Hint from './hint.svelte';
	import PayIn from './pay-in.svelte';
	import { coin } from '$lib/format';

	/**
	 * The DAO's balance with the app: what it has, what was topped up and spent, the price, and
	 * how anyone tops it up (the app's address and the memo that credits this DAO). The same
	 * words as a party's own balance on the Wallet page.
	 */
	let { dao }: { dao: string } = $props();
	const billing = $derived(store.who ? remote.daoBilling(dao) : null);
</script>

<section id="balance" class="scroll-mt-24 space-y-3">
	<h2 class="eyebrow flex items-center gap-1.5">
		Balance <Hint
			text="Pays for everything done in this DAO. Every transaction costs network traffic at the price shown. Top-ups are not refunded."
		/>
	</h2>
	{#if billing?.ready}
		{@const b = billing.current}
		<div class="font-mono text-figure font-bold {b.balance > 0 ? 'text-ink' : 'text-red'}">
			{coin(b.balance)}
			<span class="text-xs font-normal text-ink-dim">available</span>
		</div>
		<p class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-ink-dim">
			<span>Topped up <span class="text-ink">{coin(b.credited)}</span></span>
			<span>Spent <span class="text-ink">{coin(b.charged)}</span></span>
			<span title="Network traffic price, net of app rewards."
				>Price <span class="text-ink">{coin(b.coinPerMb)} per MB</span></span
			>
		</p>
		{#if b.balance <= 0}
			<p class="text-body-sm text-red">Balance empty. Top up to act.</p>
		{/if}
		<PayIn payTo={b.payTo} memo={b.memo} open={b.balance <= 0} anyone />
	{:else if billing?.error}
		<QueryError error={billing.error} refresh={() => billing?.reconnect()} />
	{:else}
		<Skeleton height="h-16" />
	{/if}
</section>
