<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import Hint from './hint.svelte';
	import {
		PRESETS,
		presetOf,
		describe,
		standing,
		type Preset,
		type Rule,
		type Settings,
		fractionWords,
		settingsFields
	} from '$lib/rules';
	import { fmt } from '$lib/format';

	/**
	 * One category's settings, as a short list of settings: a preset to start from, then each
	 * dial on its own line — what yes is measured against, what it takes, the quorum, the two
	 * switches for time, and how long a vote is open. Every line explains itself, and the last
	 * one says what it all comes to in this DAO's numbers. The values travel in the form under
	 * `prefix` (`routineBasis`, `routineDays`…), so what is signed is what was set.
	 */
	let {
		settings = $bindable(),
		prefix,
		eligible = 0,
		equal = false,
		part = 'passing',
		extra
	}: {
		settings: Settings;
		prefix: string;
		eligible?: number;
		equal?: boolean;
		/**
		 * `passing`: what it takes and for how long (and the form's fields, all of them);
		 * `ballot`: how members vote, secret or not, changeable or not. Both bind the same settings.
		 */
		part?: 'passing' | 'ballot';
		/** More ballot rows, such as picking several options on a choice. */
		extra?: import('svelte').Snippet;
	} = $props();

	// What screen readers hear before each control: whose rule this is.
	const whose = $derived(/ensitive$/.test(prefix) ? 'Voting rules' : 'This proposal');
	const arithmetic = (r: Rule) => ({ ...r, early: true, changeable: false });
	const rule = $derived(settings.rule);
	// The preset the dials stand at, or custom; a dial moved by hand changes it accordingly.
	const preset = $derived<Preset>(presetOf(arithmetic(rule)));
	const set = (patch: Partial<Rule>) =>
		(settings = { ...settings, rule: { ...settings.rule, ...patch } });
	const pick = (p: Preset) => {
		const found = PRESETS.find((x) => x.value === p)?.rule;
		if (found) set({ basis: found.basis, threshold: { ...found.threshold }, quorum: found.quorum });
	};
	const percent = $derived(rule.threshold.kind === 'percent' ? rule.threshold.percent : 67);
	const num = $derived(rule.threshold.kind === 'fraction' ? rule.threshold.num : 2);
	const den = $derived(rule.threshold.kind === 'fraction' ? rule.threshold.den : 3);
	const unit = (n: number) => (equal ? (n === 1 ? 'member' : 'members') : 'units');
	const here = $derived.by(() => {
		if (eligible <= 0) return '';
		const of = `${fmt(eligible)} ${unit(eligible)}`;
		const quorum =
			rule.quorum > 0
				? ` At least ${fmt(Math.ceil((eligible * rule.quorum) / 100))} of ${of} must vote.`
				: '';
		if (rule.basis === 'all')
			return `Here: ${fmt(standing(rule, 0, 0, 0, eligible).needed)} of ${of} must say yes.${quorum}`;
		const t = rule.threshold;
		const need =
			t.kind === 'majority'
				? 'more yes than no'
				: t.kind === 'percent'
					? `at least ${t.percent}% yes`
					: `at least ${fractionWords(t.num, t.den)} yes`;
		return `Here: ${need} among those who vote.${quorum}`;
	});
	const help = {
		preset:
			'A starting point for the three settings below. Majority of the vote: more than half of everyone who could vote. Majority of votes cast: more yes than no among those who vote, a quarter taking part. Two thirds and unanimous: of the whole vote. Change any setting and it reads custom.',
		basis:
			'The whole vote: yes is compared with everyone who could vote, so a member who stays silent counts as a no, and the app, which hands the ballots to the ledger, cannot pass anything by leaving ballots out; it could still make a proposal fail by leaving out yes ballots. The votes cast: yes is compared with the yes and no actually cast, so a few voters can decide unless a quorum says how many must take part, and the app could sway it either way by leaving ballots out.',
		threshold:
			'More than half: strictly over 50% of what yes is compared with; 50 of 100 is not enough, 51 is. A fraction, say two thirds: at least that much, rounded up — two of three. A percentage: at least that share; 100% means everyone.',
		quorum:
			'How much of the whole vote must take part, yes, no or abstain, for the result to count at all. Below it the proposal fails at the deadline whatever the yes count. 0 means no minimum. Matters most with "the votes cast"; note that a quorum is met or not by the ballots the app hands in.',
		early:
			'The proposal settles the moment its outcome can no longer change: yes has enough even if everyone still silent said no, or yes can no longer reach enough even if they all said yes. Otherwise it waits for the deadline.',
		changeable:
			'A voter may replace their ballot any number of times until the deadline. Because a vote may still change, ballots are counted only at the deadline, and nothing settles early: turning this on turns settling early off.',
		secret:
			'Members see the totals, not who voted how; each sees their own vote. The ballots are signed and on the ledger all the same, and the app, which counts them, sees them.',
		days: 'How long a vote is open from the moment the proposal is signed, in days: 1 to 90.'
	};
	const row = 'grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]';
	const label =
		'flex items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase';
	const select = 'block w-full border border-border bg-surface px-3 py-2 text-sm';
</script>

{#if part === 'ballot'}
	<div class="divide-y divide-border border border-border">
		<div class="{row} px-4 py-3">
			<span class={label}>Secret ballot <Hint text={help.secret} /></span>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					class="accent-orange"
					aria-label="{whose}: secret ballot"
					checked={!!rule.secret}
					onchange={(e) => set({ secret: (e.currentTarget as HTMLInputElement).checked })}
				/>
				<span class="text-ink-mid">nobody is shown who voted how</span>
			</label>
		</div>
		<div class="{row} px-4 py-3">
			<span class={label}>Votes may change <Hint text={help.changeable} /></span>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					class="accent-orange"
					aria-label="{whose}: votes may change"
					checked={rule.changeable}
					onchange={(e) => {
						const on = (e.currentTarget as HTMLInputElement).checked;
						set({ changeable: on, early: on ? false : rule.early });
					}}
				/>
				<span class="text-ink-mid"
					>until the deadline; counted only then{rule.changeable
						? ', so it does not settle early'
						: ''}</span
				>
			</label>
		</div>
		{@render extra?.()}
	</div>
{:else}
	{#each settingsFields(prefix, settings) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}

	<div class="divide-y divide-border border border-border">
		<div class="{row} px-4 py-3">
			<span class={label}>Preset <Hint text={help.preset} /></span>
			<select
				class={select}
				value={preset}
				aria-label="{whose}: preset"
				onchange={(e) => pick((e.currentTarget as HTMLSelectElement).value as Preset)}
			>
				{#each PRESETS as p (p.value)}<option value={p.value}>{p.title}</option>{/each}
			</select>
		</div>
		<div class="{row} px-4 py-3">
			<span class={label}>Yes measured against <Hint text={help.basis} /></span>
			<select
				class={select}
				value={rule.basis}
				onchange={(e) =>
					set({ basis: (e.currentTarget as HTMLSelectElement).value as Rule['basis'] })}
			>
				<option value="all">the whole vote</option>
				<option value="cast">the votes cast</option>
			</select>
		</div>
		<div class="{row} px-4 py-3">
			<span class={label}>It takes <Hint text={help.threshold} /></span>
			<div class="flex items-center gap-2">
				<select
					class={select}
					value={rule.threshold.kind}
					onchange={(e) => {
						const kind = (e.currentTarget as HTMLSelectElement).value;
						set({
							threshold:
								kind === 'percent'
									? { kind: 'percent', percent }
									: kind === 'fraction'
										? { kind: 'fraction', num, den }
										: { kind: 'majority' }
						});
					}}
				>
					<option value="majority">more than half</option>
					<option value="fraction">at least a fraction of it (two thirds…)</option>
					<option value="percent">at least a percentage</option>
				</select>
				{#if rule.threshold.kind === 'percent'}
					<Input
						type="number"
						min={1}
						max={100}
						class="w-24 text-right"
						aria-label="{whose}: percent of yes"
						value={rule.threshold.percent}
						oninput={(e) =>
							set({
								threshold: {
									kind: 'percent',
									percent: Number((e.currentTarget as HTMLInputElement).value)
								}
							})}
					/>
					<span class="font-mono text-xs text-ink-dim">%</span>
				{:else if rule.threshold.kind === 'fraction'}
					<Input
						type="number"
						min={1}
						max={100}
						class="w-16 text-right"
						aria-label="{whose}: fraction, numerator"
						value={rule.threshold.num}
						oninput={(e) =>
							set({
								threshold: {
									kind: 'fraction',
									num: Number((e.currentTarget as HTMLInputElement).value) || 1,
									den
								}
							})}
					/>
					<span class="font-mono text-xs text-ink-dim">/</span>
					<Input
						type="number"
						min={1}
						max={100}
						class="w-16 text-right"
						aria-label="{whose}: fraction, denominator"
						value={rule.threshold.den}
						oninput={(e) =>
							set({
								threshold: {
									kind: 'fraction',
									num,
									den: Number((e.currentTarget as HTMLInputElement).value) || 1
								}
							})}
					/>
				{/if}
			</div>
		</div>
		<div class="{row} px-4 py-3">
			<span class={label}>Quorum <Hint text={help.quorum} /></span>
			<div class="flex items-center gap-2">
				<Input
					type="number"
					min={0}
					max={100}
					class="w-24 text-right"
					aria-label="{whose}: quorum"
					value={rule.quorum}
					oninput={(e) =>
						set({
							quorum: Math.max(
								0,
								Math.min(100, Number((e.currentTarget as HTMLInputElement).value) || 0)
							)
						})}
				/>
				<span class="font-mono text-xs text-ink-dim">% of the vote must take part; 0 for none</span>
			</div>
		</div>
		<div class="{row} px-4 py-3">
			<span class={label}>Settle early <Hint text={help.early} /></span>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					class="accent-orange"
					aria-label="{whose}: settle early"
					checked={rule.early}
					onchange={(e) => {
						const on = (e.currentTarget as HTMLInputElement).checked;
						set({ early: on, changeable: on ? false : rule.changeable });
					}}
				/>
				<span class="text-ink-mid"
					>{rule.changeable
						? 'off while votes may change (under Ballot): the count waits for the deadline'
						: 'the moment the outcome can no longer change'}</span
				>
			</label>
		</div>
		<div class="{row} px-4 py-3">
			<span class={label}>Voting period <Hint text={help.days} /></span>
			<div class="flex items-center gap-2">
				<Input
					type="number"
					min={1}
					max={90}
					class="w-24 text-right"
					aria-label="{whose}: voting days"
					value={settings.votingDays}
					oninput={(e) =>
						(settings = {
							...settings,
							votingDays: Math.max(
								1,
								Math.min(90, Number((e.currentTarget as HTMLInputElement).value) || 1)
							)
						})}
				/>
				<span class="font-mono text-xs text-ink-dim">days</span>
			</div>
		</div>
		{#if rule.threshold.kind === 'fraction' && rule.threshold.num > rule.threshold.den}
			<p class="px-4 py-3 font-mono text-xs text-red">
				A fraction is at most one: the top number no more than the bottom.
			</p>
		{:else}
			<p class="px-4 py-3 font-mono text-xs text-ink">
				Passes when {describe(rule)}; {rule.early
					? 'settles early once sure'
					: rule.changeable
						? 'votes may change, decided at the deadline'
						: 'decided at the deadline'}. {here}
			</p>
		{/if}
	</div>
{/if}
