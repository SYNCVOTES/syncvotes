<script lang="ts">
	import Hint from './hint.svelte';
	import { CATEGORIES, describe, standing, type Settings } from '$lib/rules';
	import { fmt } from '$lib/format';

	/**
	 * A DAO's settings, read at a glance: for each category, what it covers, the rule its
	 * proposals pass by, in words and — given the size of the vote — in numbers, and how long a
	 * vote is open.
	 */
	let {
		routine,
		sensitive,
		eligible = 0,
		equal = false,
		compact = false
	}: {
		routine: Settings;
		sensitive: Settings;
		eligible?: number;
		equal?: boolean;
		compact?: boolean;
	} = $props();
	const both = $derived({ routine, sensitive });
	const unit = (n: number) => (equal ? (n === 1 ? 'member' : 'members') : 'units');
	function here(s: Settings): string {
		if (eligible <= 0) return '';
		const r = s.rule;
		const of = `${fmt(eligible)} ${unit(eligible)}`;
		const quorum =
			r.quorum > 0 ? `; ${fmt(Math.ceil((eligible * r.quorum) / 100))} of ${of} must vote` : '';
		if (r.basis === 'all')
			return `${fmt(standing(r, 0, 0, 0, eligible).needed)} of ${of} say yes${quorum}`;
		return `${r.threshold.kind === 'majority' ? 'more yes than no' : `${r.threshold.percent}% yes`} among those who vote${quorum}`;
	}
	const timing = (s: Settings) =>
		s.rule.early
			? 'settles early once sure'
			: s.rule.changeable
				? 'votes may change; decided at the deadline'
				: 'decided at the deadline';
</script>

<dl class="divide-y divide-border border border-border">
	{#each CATEGORIES as c (c.value)}
		{@const s = both[c.value]}
		<div class="space-y-1 px-4 py-3">
			<dt
				class="flex items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.14em] text-ink-dim uppercase"
			>
				{c.title}
				<Hint text={c.covers} />
			</dt>
			<dd class="text-[13px] leading-relaxed text-ink">
				{#if !compact}<span class="text-ink-mid">{c.text}</span><br />{/if}
				Passes when {describe(s.rule)}; {timing(s)}. Open for {s.votingDays}
				{s.votingDays === 1 ? 'day' : 'days'}.
				{#if here(s)}<span class="block font-mono text-xs text-ink-mid">Here: {here(s)}.</span>{/if}
			</dd>
		</div>
	{/each}
</dl>
