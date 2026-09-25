<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Panel from './panel.svelte';
	import Skeleton from './skeleton.svelte';
	import CopyField from './copy-field.svelte';
	import QueryError from './query-error.svelte';
	import Hint from './hint.svelte';
	import { coin } from '$lib/format';

	/**
	 * The DAO's balance with the app: what was paid in, what its transactions have cost, what
	 * that leaves — and how to pay in: the app's address and the memo that credits this DAO.
	 */
	let { dao }: { dao: string } = $props();
	const billing = $derived(store.who ? remote.daoBilling(dao) : null);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow flex items-center gap-1.5">
		Balance <Hint
			text="Every transaction the DAO makes costs network traffic, charged to the DAO at the price shown. The balance is what was paid in for the DAO less what its transactions have cost. When it reaches zero, nothing can be signed for this DAO until someone pays in. What is paid in is spent on traffic and is not paid back."
		/>
	</h2>
	{#if billing?.ready}
		{@const b = billing.current}
		<div class="font-mono text-2xl font-bold {b.balance > 0 ? 'text-ink' : 'text-red'}">
			{coin(b.balance)}
			<span class="text-xs font-normal text-ink-dim">to spend</span>
		</div>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
			<dt class="text-ink-dim">Paid in</dt>
			<dd class="text-ink">{coin(b.credited)}</dd>
			<dt class="text-ink-dim">Spent</dt>
			<dd class="text-ink">{coin(b.charged)}</dd>
			<dt class="text-ink-dim">Price</dt>
			<dd
				class="text-ink"
				title="The network's traffic price, less what the network pays back for this traffic in rewards"
			>
				{coin(b.coinPerMb)} per MB{b.factor !== 1
					? ` (${b.factor}× the network's, net of rewards)`
					: ''}
			</dd>
		</dl>
		{#if b.balance <= 0}
			<p class="text-body-sm text-red">
				Empty: nothing can be signed for this DAO until someone pays in.
			</p>
		{/if}
		<div class="space-y-3 border-t border-border pt-3">
			<p class="text-body-sm text-ink-mid">
				Anyone pays in by sending Canton Coin to this address from any wallet, with this memo as the
				transfer's reason. Coin without the memo is not credited to anyone.
			</p>
			<CopyField label="Address" value={b.payTo} />
			<CopyField label="Memo" value={b.memo} />
		</div>
	{:else if billing?.error}
		<QueryError error={billing.error} refresh={() => billing?.reconnect()} />
	{:else}
		<Skeleton height="h-16" />
	{/if}
</Panel>
