<script lang="ts">
	import Hint from './hint.svelte';
	import { fmt } from '$lib/format';
	import { describe, standing, type Rule } from '$lib/rules';

	/**
	 * Yes, no and abstentions against the proposal's own rule: what it takes, how far it is,
	 * whether the quorum is met. Everything is in units of the vote, shown as a share of the
	 * whole. An abstention takes part but takes no side.
	 */
	let {
		yes,
		no,
		abstain,
		eligible,
		cast,
		rule,
		counted = true
	}: {
		yes: number;
		no: number;
		abstain: number;
		eligible: number;
		cast: number;
		rule: Rule;
		/** Whether these are the ledger's figures, or what is cast and not yet counted. */
		counted?: boolean;
	} = $props();
	const taken = $derived(yes + no + abstain);
	const s = $derived(standing(rule, yes, no, abstain, eligible));
	const pct = (n: number) => (eligible > 0 ? (n / eligible) * 100 : 0);
	const w = (n: number) => `${Math.round(pct(n) * 100) / 100}%`;
	const timing = $derived(
		rule.early
			? '; settles early once sure'
			: rule.changeable
				? '; votes may change, so decided at the deadline'
				: '; decided at the deadline'
	);
</script>

<section class="space-y-3">
	<h2 class="eyebrow flex items-center gap-1.5">
		Tally <Hint
			text="Shares of the whole vote at the time the proposal opened. The middle figure is what yes must reach. Passes when {describe(
				rule
			)}{timing}. The app counts ballots; the ledger checks each one."
		/>
	</h2>
	<div class="flex h-2 overflow-hidden bg-surface-active">
		<div class="bg-green" style="width: {pct(yes)}%"></div>
		<div class="bg-red" style="width: {pct(no)}%"></div>
		<div class="bg-ink-dim" style="width: {pct(abstain)}%"></div>
	</div>
	<div class="flex justify-between gap-2 font-mono text-xs">
		<span class="text-green">{w(yes)} yes</span>
		<span class="text-ink-dim">
			{rule.basis === 'all'
				? `${w(s.needed)} to pass`
				: yes + no === 0
					? `${describe(rule).replace(/ say yes.*$/, '')} to pass`
					: `${w(s.needed)} of ${w(s.denominator)} cast to pass`}
		</span>
		<span class="text-red">{w(no)} no</span>
	</div>
	<p class="font-mono text-xs text-ink-dim">
		{fmt(cast)} voted, {w(taken)} of the vote{abstain ? `, ${w(abstain)} abstaining` : ''}{counted
			? ''
			: ' (not yet counted)'}.{s.note ? ` Now ${s.note}.` : ''}
	</p>
</section>
