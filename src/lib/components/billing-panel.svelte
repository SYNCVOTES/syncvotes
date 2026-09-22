<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Panel from './panel.svelte';
	import Skeleton from './skeleton.svelte';
	import CopyField from './copy-field.svelte';
	import { coin } from '$lib/format';

	/**
	 * The DAO's balance: what was paid in, what its transactions have cost, and how anyone pays
	 * in — coin sent to the app's provider from any Canton wallet, with the DAO's memo, is
	 * credited within a minute of landing.
	 */
	let { dao }: { dao: string } = $props();
	const billing = $derived(store.who ? remote.daoBilling(dao) : null);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">Balance</h2>
	{#if billing?.ready}
		{@const b = billing.current}
		<div class="font-mono text-2xl font-bold {b.balance > 0 ? 'text-ink' : 'text-red'}">
			{coin(b.balance)}
		</div>
		<p class="font-mono text-xs text-ink-dim">
			{coin(b.credited)} paid in, {coin(b.charged)} spent on traffic. A megabyte costs {coin(
				b.coinPerMb
			)}{b.factor !== 1 ? ` (${b.factor}× the network's price)` : ''}.
		</p>
		{#if b.balance <= 0}
			<p class="text-[13px] text-red">
				Empty: nothing can be signed for this DAO until someone pays in.
			</p>
		{/if}
		<div class="space-y-3 border-t border-border pt-3">
			<p class="text-[13px] text-ink-mid">
				To pay in, send Canton Coin from any wallet to the app's provider with this memo. It is
				credited within a minute of landing.
			</p>
			<CopyField label="To" value={b.payTo} />
			<CopyField label="Memo" value={b.memo} />
		</div>
	{:else}
		<Skeleton height="h-16" />
	{/if}
</Panel>
