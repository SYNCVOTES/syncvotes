<script lang="ts">
	import Hint from './hint.svelte';
	import { CATEGORIES, describe, standing, fractionWords, type Settings } from '$lib/rules';
	import { fmt } from '$lib/format';

	/**
	 * A DAO's settings, read at a glance: for each category, what it covers, the rule its
	 * proposals pass by, in words and — given the size of the vote — in numbers, and how long a
	 * vote is open.
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
	const timing = (s: Settings) =>
		s.rule.early
			? 'settles early once sure'
			: s.rule.changeable
				? 'votes may change; decided at the deadline'
				: 'decided at the deadline';
</script>

<dl class="divide-y divide-border border border-border">
	<div class="space-y-1 px-4 py-3">
		<dt
			class="flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.14em] text-ink-dim uppercase"
		>
			{category.title}
			<Hint text={category.covers} />
		</dt>
		<dd class="text-[13px] leading-relaxed text-ink">
			{#if !compact}<span class="text-ink-mid">{category.text}</span><br />{/if}
			Passes when {describe(sensitive.rule)}; {timing(sensitive)}. Open for {sensitive.votingDays}
			{sensitive.votingDays === 1 ? 'day' : 'days'}.
			{#if here(sensitive)}<span class="block font-mono text-xs text-ink-mid"
					>Here: {here(sensitive)}.</span
				>{/if}
		</dd>
	</div>
	<div class="space-y-1 px-4 py-3">
		<dt
			class="flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.14em] text-ink-dim uppercase"
		>
			{routine.title}
			<Hint text={routine.covers} />
		</dt>
		<dd class="text-[13px] leading-relaxed text-ink-mid">{routine.text}</dd>
	</div>
</dl>
