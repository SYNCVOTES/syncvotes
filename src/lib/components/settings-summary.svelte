<script lang="ts">
	import Hint from './hint.svelte';
	import { CATEGORIES, describe, standing, fractionWords, type Settings } from '$lib/rules';
	import { fmt } from '$lib/format';

	/**
	 * A DAO's voting rules, read at a glance: for changes to the DAO, the ballot, the rule they
	 * pass by and how long a vote is open, with this DAO's numbers; for decisions and choices,
	 * that their proposer sets all that. `compact` gives each one line, the sentence behind a Hint.
	 */
	let {
		sensitive,
		eligible = 0,
		equal = false,
		compact = false
	}: {
		/** The rule everything that changes the DAO passes by. */
		sensitive: Settings;
		eligible?: number;
		equal?: boolean;
		compact?: boolean;
	} = $props();
	const category = CATEGORIES.find((c) => c.value === 'sensitive')!;
	const routine = CATEGORIES.find((c) => c.value === 'routine')!;
	const unit = (n: number) => (equal ? (n === 1 ? 'member' : 'members') : 'units');
	function here(s: Settings): string {
		if (eligible <= 0) return '';
		const r = s.rule;
		const of = `${fmt(eligible)} ${unit(eligible)}`;
		const quorum =
			r.quorum > 0 ? `; ${fmt(Math.ceil((eligible * r.quorum) / 100))} of ${of} must vote` : '';
		if (r.basis === 'all')
			return `${fmt(standing(r, 0, 0, 0, eligible).needed)} of ${of} say yes${quorum}`;
		const t = r.threshold;
		const need =
			t.kind === 'majority'
				? 'more yes than no'
				: t.kind === 'percent'
					? `${t.percent}% yes`
					: `${fractionWords(t.num, t.den)} yes`;
		return `${need} among those who vote${quorum}`;
	}
	const ballot = (s: Settings) =>
		`${s.rule.secret ? 'Secret' : 'Open'} ballot; votes ${s.rule.changeable ? 'may change until the deadline' : 'final once cast'}`;
	const timing = (s: Settings) =>
		s.rule.early ? 'settles early once sure' : 'decided at the deadline';
	const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
	/** "2/3 of the whole vote · settles early · 14 days" */
	function oneLine(s: Settings): string {
		const r = s.rule;
		const t = r.threshold;
		const amount =
			t.kind === 'majority'
				? 'Majority'
				: t.kind === 'percent'
					? `${t.percent}%`
					: `${t.num}/${t.den}`;
		const of = r.basis === 'all' ? 'of the whole vote' : 'of votes cast';
		return [
			`${amount} ${of}`,
			r.quorum > 0 ? `${r.quorum}% quorum` : '',
			r.secret ? 'secret' : '',
			r.changeable ? 'votes may change' : r.early ? 'settles early' : '',
			days(s.votingDays)
		]
			.filter(Boolean)
			.join(' · ');
	}
	const sentence = (s: Settings) =>
		`${ballot(s)}. Passes when ${describe(s.rule)}; ${timing(s)}. Open for ${days(s.votingDays)}.${here(s) ? ` In this DAO: ${here(s)}.` : ''}`;
</script>

<dl class="divide-y divide-border {compact ? '' : 'border border-border'}">
	<div class="space-y-1 {compact ? 'py-3' : 'px-4 py-3'}">
		<dt
			class="flex items-center gap-1.5 font-mono text-label tracking-[0.14em] text-ink-dim uppercase"
		>
			{category.title}
			<Hint text={compact ? `${category.covers} ${sentence(sensitive)}` : category.covers} />
		</dt>
		{#if compact}
			<dd class="font-mono text-xs text-ink">{oneLine(sensitive)}</dd>
		{:else}
			<dd class="text-body-sm leading-relaxed text-ink">
				<span class="text-ink-mid">{category.text}</span><br />
				{ballot(sensitive)}. Passes when {describe(sensitive.rule)}; {timing(sensitive)}. Open for {days(
					sensitive.votingDays
				)}.
				{#if here(sensitive)}<span class="block font-mono text-xs text-ink-mid"
						>In this DAO: {here(sensitive)}.</span
					>{/if}
			</dd>
		{/if}
	</div>
	<div class="space-y-1 {compact ? 'py-3' : 'px-4 py-3'}">
		<dt
			class="flex items-center gap-1.5 font-mono text-label tracking-[0.14em] text-ink-dim uppercase"
		>
			{routine.title}
			<Hint text={routine.covers} />
		</dt>
		<dd class="text-body-sm leading-relaxed text-ink-mid">{routine.text}</dd>
	</div>
</dl>
