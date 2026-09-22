<script lang="ts">
	import Panel from './panel.svelte';
	import { fmt } from '$lib/format';
	import { describe, standing, type Rule } from '$lib/rules';

	/**
	 * Yes, no and abstentions against the proposal's own rule: what it takes, how far it is,
	 * whether the quorum is met. An abstention takes part but takes no side.
	 */
	let {
		yes,
		no,
		abstain,
		eligible,
		cast,
		rule
	}: { yes: number; no: number; abstain: number; eligible: number; cast: number; rule: Rule } =
		$props();
	const counted = $derived(yes + no + abstain);
	const s = $derived(standing(rule, yes, no, abstain, eligible));
	const pct = (n: number) => (eligible > 0 ? (n / eligible) * 100 : 0);
	const w = (n: number) => `${Math.round(n * 100) / 100}%`;
</script>

<Panel padding="sm">
	<h2 class="eyebrow mb-4">Tally</h2>
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
		{fmt(cast)} voted, {w(counted)} of the vote{abstain ? `, ${w(abstain)} abstaining` : ''}.
	</p>
	<p class="mt-2 text-xs text-ink-dim">
		Passes when {describe(rule)}{rule.early ? '' : '; decided at the deadline only'}.{s.note
			? ` Now ${s.note}.`
			: ''}
	</p>
</Panel>
