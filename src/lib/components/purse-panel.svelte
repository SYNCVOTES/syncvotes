<script lang="ts">
	import Panel from './panel.svelte';
	import CopyField from './copy-field.svelte';
	import Hint from './hint.svelte';
	import { coin } from '$lib/format';

	/**
	 * A party's own balance with the app: what was paid in for its key, what its own
	 * transactions cost, what that leaves — and how to pay in: the app's address and the memo
	 * that credits this key. Before the party exists, what a party costs today and how much
	 * of it has arrived.
	 */
	let {
		statement,
		needed = null
	}: {
		statement: {
			payTo: string;
			memo: string;
			credited: number;
			charged: number;
			balance: number;
			coinPerMb: number;
			factor: number;
		};
		/** What a new party costs, while there is none yet. */
		needed?: number | null;
	} = $props();
	const s = $derived(statement);
	const short = $derived(needed !== null && s.credited < needed ? needed - s.credited : 0);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow flex items-center gap-1.5">
		Balance <Hint
			text="What you pay for yourself: your party's allocation, your profile, the DAOs you found, and in a DAO where each member pays, what you sign there. Every transaction costs network traffic at the price shown. What is paid in is spent on traffic and is not paid back."
		/>
	</h2>
	{#if needed !== null}
		<div class="font-mono text-2xl font-bold {short > 0 ? 'text-amber' : 'text-green'}">
			{coin(s.credited)}
			<span class="text-xs font-normal text-ink-dim">of {coin(needed)} for a party</span>
		</div>
		{#if short > 0}
			<p class="text-body-sm text-ink-mid">
				A party costs {coin(needed)} today — its allocation and its account, at the network's traffic
				price. Send at least {coin(short)} more with the memo below; whatever is left over stays on your
				balance.
			</p>
		{:else}
			<p class="text-body-sm text-green">Enough has arrived; your party is being created.</p>
		{/if}
	{:else}
		<div class="font-mono text-2xl font-bold {s.balance > 0 ? 'text-ink' : 'text-red'}">
			{coin(s.balance)}
			<span class="text-xs font-normal text-ink-dim">to spend</span>
		</div>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
			<dt class="text-ink-dim">Paid in</dt>
			<dd class="text-ink">{coin(s.credited)}</dd>
			<dt class="text-ink-dim">Spent</dt>
			<dd class="text-ink">{coin(s.charged)}</dd>
			<dt class="text-ink-dim">Price</dt>
			<dd
				class="text-ink"
				title="The network's traffic price, less what the network pays back for this traffic in rewards"
			>
				{coin(s.coinPerMb)} per MB{s.factor !== 1
					? ` (${s.factor}× the network's, net of rewards)`
					: ''}
			</dd>
		</dl>
		{#if s.balance <= 0}
			<p class="text-body-sm text-red">
				Empty: a profile, a new DAO, or anything in a DAO where members pay for themselves waits
				until you pay in.
			</p>
		{/if}
	{/if}
	<div class="space-y-3 border-t border-border pt-3">
		<p class="text-body-sm text-ink-mid">
			Pay in by sending Canton Coin to this address from any wallet, with this memo as the
			transfer's reason. Coin without the memo is not credited to anyone.
		</p>
		<CopyField label="Address" value={s.payTo} />
		<CopyField label="Memo" value={s.memo} />
	</div>
</Panel>
