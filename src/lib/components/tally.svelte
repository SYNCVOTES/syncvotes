<script lang="ts">
	import Panel from './panel.svelte';
	import { coin, fmt } from '$lib/format';

	/**
	 * Yes, no and abstentions. By member: out of everyone eligible, with what it takes to pass.
	 * By stake: in coin, decided at the deadline by yes against no, once `quorum` took part.
	 * An abstention counts as taking part, and as a vote that will never be a yes.
	 */
	let {
		yes,
		no,
		abstain,
		cast,
		voting,
		eligible
	}: {
		yes: number;
		no: number;
		abstain: number;
		cast: number;
		eligible: number;
		voting: { kind: 'member' } | { kind: 'stake'; quorum: number };
	} = $props();
	const counted = $derived(yes + no + abstain);
	const total = $derived(voting.kind === 'member' ? eligible : counted);
	const needed = $derived(Math.floor(eligible / 2) + 1);
	const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
	const unit = (n: number) => (voting.kind === 'member' ? fmt(n) : coin(n));
</script>

<Panel padding="sm">
	<h2 class="eyebrow mb-4">Tally</h2>
	<div class="mb-2 flex h-2 overflow-hidden bg-surface-active">
		<div class="bg-green" style="width: {pct(yes)}%"></div>
		<div class="bg-red" style="width: {pct(no)}%"></div>
		<div class="bg-ink-dim" style="width: {pct(abstain)}%"></div>
	</div>
	<div class="flex justify-between gap-2 font-mono text-xs">
		<span class="text-green">{unit(yes)} yes</span>
		{#if voting.kind === 'member'}
			<span class="text-ink-dim">{fmt(needed)} of {fmt(eligible)} to pass</span>
		{/if}
		<span class="text-red">{unit(no)} no</span>
	</div>
	<p class="mt-3 font-mono text-xs text-ink-dim">
		{#if voting.kind === 'member'}
			{fmt(cast)} of {fmt(eligible)} voted{abstain ? `, ${fmt(abstain)} abstained` : ''}{cast >
			counted
				? `, ${fmt(cast - counted)} being counted`
				: ''}
		{:else}
			{fmt(cast)} voted with {coin(counted)}{abstain ? `, ${coin(abstain)} abstained` : ''};
			{voting.quorum > 0 ? `${coin(voting.quorum)} must take part` : 'no quorum'}. Decided at the
			deadline.
		{/if}
	</p>
</Panel>
