<script lang="ts">
	import Panel from './panel.svelte';
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
</script>

<Panel padding="sm">
	<h2 class="eyebrow mb-4 flex items-center gap-1.5">
		Tally <Hint
			text="Everything is a share of the whole vote as it stood when the proposal was made. The bar fills with yes, no and abstentions; the middle figure is what yes has to reach under this proposal's rule. Ballots are checked and counted by the ledger; the page shows what is cast until then."
		/>
	</h2>
	<div class="mb-2 flex h-2 overflow-hidden bg-surface-active">
		<div class="bg-green" style="width: {pct(yes)}%"></div>
		<div class="bg-red" style="width: {pct(no)}%"></div>
		<div class="bg-ink-dim" style="width: {pct(abstain)}%"></div>
	</div>
	<div class="flex justify-between gap-2 font-mono text-xs">
		<span class="text-green">{w(yes)} yes</span>
		<span class="text-ink-dim">
			{rule.basis === 'all'
				? `${w(s.needed)} to pass`
				: `${w(s.needed)} of ${w(s.denominator)} cast to pass`}
		</span>
		<span class="text-red">{w(no)} no</span>
	</div>
	<p class="mt-3 font-mono text-xs text-ink-dim">
		{fmt(cast)} voted, {w(taken)} of the vote{abstain ? `, ${w(abstain)} abstaining` : ''}{counted
			? ''
			: ' (cast, not yet counted)'}.
	</p>
	<p class="mt-2 text-xs text-ink-dim">
		Passes when {describe(rule)}{rule.early
			? ''
			: rule.changeable
				? '; votes may change, so decided at the deadline only'
				: '; decided at the deadline only'}.{s.note ? ` Now ${s.note}.` : ''}
	</p>
</Panel>
