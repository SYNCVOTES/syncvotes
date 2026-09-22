<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Panel from './panel.svelte';
	import Skeleton from './skeleton.svelte';
	import PartyId from './party-id.svelte';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import { coin } from '$lib/format';

	/**
	 * The DAO's balance: what its admin has paid in, what its transactions have cost, and how to
	 * pay in — coin sent to the app's provider from any Canton wallet, with the DAO's memo, is
	 * credited within a minute of landing.
	 */
	let { dao, admin }: { dao: string; admin: boolean } = $props();
	const billing = $derived(store.who ? remote.daoBilling(dao) : null);
	let copied = $state(false);
	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
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
				Empty: nothing can be signed for this DAO until {admin ? 'you pay' : 'the admin pays'} in.
			</p>
		{/if}
		{#if admin}
			<div class="space-y-2 border-t border-border pt-3 text-[13px] text-ink-mid">
				<p>
					To pay in, send Canton Coin from any wallet to the app's provider with this memo. It is
					credited within a minute of landing.
				</p>
				<div class="font-mono text-xs">
					<div class="text-ink-dim">To</div>
					<PartyId party={b.payTo} size="md" />
				</div>
				<div class="font-mono text-xs">
					<div class="text-ink-dim">Memo</div>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 text-ink hover:text-orange"
						onclick={() => copy(b.memo)}
						title="Copy the memo"
					>
						<span class="break-all">{b.memo}</span>
						{#if copied}<Check size={12} />{:else}<Copy size={12} />{/if}
					</button>
				</div>
			</div>
		{:else}
			<p class="text-[13px] text-ink-dim">The admin keeps this balance funded.</p>
		{/if}
	{:else}
		<Skeleton height="h-16" />
	{/if}
</Panel>
