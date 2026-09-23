<script lang="ts">
	import Panel from './panel.svelte';
	import Hint from './hint.svelte';
	import { fmt } from '$lib/format';
	import { describe, standing, type Rule } from '$lib/rules';

	/**
	 * A choice among options against the proposal's rule: each option's share of the vote, and
	 * what the leader has to reach — measured as a yes would be, of the whole vote or of the
	 * votes cast for options. An abstention takes part but picks nothing.
	 */
	let {
		options,
		tallies,
		abstain,
		eligible,
		cast,
		rule,
		counted = true
	}: {
		options: string[];
		tallies: number[];
		abstain: number;
		eligible: number;
		cast: number;
		rule: Rule;
		counted?: boolean;
	} = $props();
	const picked = $derived(tallies.reduce((s, t) => s + t, 0));
	const lead = $derived(Math.max(0, ...tallies));
	// The leader stands where yes stands; every other option where no does.
	const s = $derived(standing(rule, lead, picked - lead, abstain, eligible));
	const pct = (n: number) => (eligible > 0 ? (n / eligible) * 100 : 0);
	const w = (n: number) => `${Math.round(pct(n) * 100) / 100}%`;
	const tied = $derived(lead > 0 && tallies.filter((t) => t === lead).length > 1);
</script>

<Panel padding="sm">
	<h2 class="eyebrow mb-4 flex items-center gap-1.5">
		Tally <Hint
			text="Each bar is an option's share of the whole vote as it stood when the proposal was made. The option with the most votes wins if it reaches what a yes would have to under this proposal's rule, and stands alone at the top; a tie decides nothing. Ballots are checked and counted by the ledger; the page shows what is cast until then."
		/>
	</h2>
	<ol class="space-y-2">
		{#each options as o, i (i)}
			{@const t = tallies[i] ?? 0}
			<li>
				<div class="mb-1 flex justify-between gap-2 font-mono text-xs">
					<span class="truncate {t > 0 && t === lead && !tied ? 'text-green' : 'text-ink'}"
						>{o}</span
					>
					<span class="shrink-0 text-ink-dim">{w(t)}</span>
				</div>
				<div class="flex h-1.5 overflow-hidden bg-surface-active">
					<div
						class={t > 0 && t === lead && !tied ? 'bg-green' : 'bg-ink-dim'}
						style="width: {pct(t)}%"
					></div>
				</div>
			</li>
		{/each}
	</ol>
	<p class="mt-3 font-mono text-xs text-ink-dim">
		{fmt(cast)} voted, {w(picked + abstain)} of the vote{abstain
			? `, ${w(abstain)} abstaining`
			: ''}{counted ? '' : ' (cast, not yet counted)'}. The leader needs {w(
			s.needed
		)}{rule.basis === 'all' ? '' : ' of the votes for options'}{tied
			? '; tied at the top now'
			: ''}.
	</p>
	<p class="mt-2 text-xs text-ink-dim">
		Decided when the leading option has {describe(rule).replace(/ say yes/, '')}{rule.early
			? ''
			: rule.changeable
				? '; votes may change, so decided at the deadline only'
				: '; decided at the deadline only'}.{s.note ? ` Now ${s.note}.` : ''}
	</p>
</Panel>
