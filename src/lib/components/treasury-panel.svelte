<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Panel from './panel.svelte';
	import Skeleton from './skeleton.svelte';
	import CopyField from './copy-field.svelte';
	import Hint from './hint.svelte';
	import { coin } from '$lib/format';

	/**
	 * The DAO's treasury: what it holds, what it owes for traffic, what that leaves to spend —
	 * and its address, which anyone can send Canton Coin to from any wallet. Coin leaves it
	 * only as a vote decides.
	 */
	let { dao }: { dao: string } = $props();
	const billing = $derived(store.who ? remote.daoBilling(dao) : null);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow flex items-center gap-1.5">
		Treasury <Hint
			text="What the DAO's own address holds. Every transaction the DAO makes costs network traffic, charged to the DAO at the price shown and collected from here once it adds up; what is left after that is what the DAO can spend on payouts and on its next transactions. When it reaches zero, nothing can be signed for this DAO until someone pays in."
		/>
	</h2>
	{#if billing?.ready}
		{@const b = billing.current}
		<div class="font-mono text-2xl font-bold {b.balance > 0 ? 'text-ink' : 'text-red'}">
			{coin(b.holdings)}
		</div>
		<p class="font-mono text-xs text-ink-dim">
			{#if b.due > 0.005}{coin(b.due)} owed for traffic, {coin(b.balance)} to spend.{:else}Nothing
				owed.{/if}
			{coin(b.charged)} spent on traffic so far; a megabyte costs {coin(b.coinPerMb)}{b.factor !== 1
				? ` (${b.factor}× the network's price)`
				: ''}.
		</p>
		{#if b.balance <= 0}
			<p class="text-[13px] text-red">
				Empty: nothing can be signed for this DAO until someone pays in.
			</p>
		{/if}
		<div class="space-y-3 border-t border-border pt-3">
			<p class="text-[13px] text-ink-mid">
				Anyone pays in by sending Canton Coin to this address from any wallet. It leaves only by
				vote: a payout, or the remainder when the DAO dissolves.
			</p>
			<CopyField label="Address" value={b.treasury} />
		</div>
	{:else}
		<Skeleton height="h-16" />
	{/if}
</Panel>
