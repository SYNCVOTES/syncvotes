<script lang="ts">
	import Hint from './hint.svelte';
	import PayIn from './pay-in.svelte';
	import { coin } from '$lib/format';

	/**
	 * A party's own balance with the app: what it has, what was topped up and spent, the price,
	 * and how to top up (the app's address and the memo that credits this key). Before the
	 * party exists, what a party costs today and how much of it has arrived.
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

<section class="space-y-3">
	<h2 class="eyebrow flex items-center gap-1.5">
		Balance <Hint
			text="Pays for your profile, DAOs you create, and your actions in DAOs where members pay. Every transaction costs network traffic at the price shown. Top-ups are not refunded."
		/>
	</h2>
	{#if needed !== null}
		<div class="font-mono text-figure font-bold {short > 0 ? 'text-amber' : 'text-green'}">
			{coin(s.credited)}
			<span class="text-xs font-normal text-ink-dim">of {coin(needed)} for a party</span>
		</div>
		{#if short > 0}
			<p class="text-body-sm text-ink-mid">
				Send at least {coin(short)} more with the memo below. Any extra stays on your balance.
			</p>
		{:else}
			<p class="text-body-sm text-green">Received. Creating your party…</p>
		{/if}
	{:else}
		<div class="font-mono text-figure font-bold {s.balance > 0 ? 'text-ink' : 'text-red'}">
			{coin(s.balance)}
			<span class="text-xs font-normal text-ink-dim">available</span>
		</div>
		<p class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-ink-dim">
			<span>Topped up <span class="text-ink">{coin(s.credited)}</span></span>
			<span>Spent <span class="text-ink">{coin(s.charged)}</span></span>
			<span title="Network traffic price, net of app rewards."
				>Price <span class="text-ink">{coin(s.coinPerMb)} per MB</span></span
			>
		</p>
		{#if s.balance <= 0}
			<p class="text-body-sm text-red">Balance empty. Top up to continue.</p>
		{/if}
	{/if}
	<PayIn payTo={s.payTo} memo={s.memo} open={needed !== null || s.balance <= 0} />
</section>
