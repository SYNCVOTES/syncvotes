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
		collapsed = false,
		bare = false,
		extra,
		ballot
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
		/**
		 * `passing` only: show the preset and what it comes to, with every other dial (and the
		 * `ballot` snippet) behind "Customise". The fields travel either way.
		 */
		collapsed?: boolean;
		/** `ballot` only: the rows without a frame of their own, to sit inside another. */
		bare?: boolean;
		/** More ballot rows, such as picking several options on a choice. */
		extra?: import('svelte').Snippet;
		/** With `collapsed`: the ballot rows, shown inside the same disclosure. */
		ballot?: import('svelte').Snippet;
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
			return `In this DAO: ${fmt(standing(rule, 0, 0, 0, eligible).needed)} of ${of} must say yes.${quorum}`;
		const t = rule.threshold;
		const need =
			t.kind === 'majority'
				? 'more yes than no'
				: t.kind === 'percent'
					? `at least ${t.percent}% yes`
					: `at least ${fractionWords(t.num, t.den)} yes`;
		return `In this DAO: ${need} among those who vote.${quorum}`;
	});
	const help = {
		preset: 'Common rules. Changing any setting below switches to Custom.',
		basis: 'Whole vote: silence counts as no. Votes cast: only yes and no count, so set a quorum.',
		threshold: "More than half means over 50%: 51 of 100 passes, 50 doesn't. Fractions round up.",
		quorum:
			'Share of the whole vote that must take part (yes, no or abstain). Below it, the proposal fails.',
		early: "Close as soon as the remaining votes can't change the outcome.",
		changeable:
			"Voters can recast until the deadline. Counting waits for the deadline, so the proposal can't settle early.",
		secret:
			'Members see totals and their own vote only. The app still sees each ballot, because it counts them.',
		days: 'Days the vote stays open, 1–90.'
	};
	const row = 'grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]';
	const label =
		'flex items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase';
	const select = 'block h-10 w-full min-w-0 border border-border bg-surface px-3 text-sm';
</script>

{#if part === 'ballot'}
	<div class="divide-y divide-border {bare ? '' : 'border border-border'}">
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
				<span class="text-ink-mid">hide who voted how</span>
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
				<span class="text-ink-mid">until the deadline</span>
			</label>
		</div>
		{@render extra?.()}
	</div>
{:else}
	{#each settingsFields(prefix, settings) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}

	{#snippet dials()}
		<div class="{row} px-4 py-3">
			<span class={label}>Basis <Hint text={help.basis} /></span>
			<select
				class={select}
				value={rule.basis}
				aria-label="{whose}: basis"
				onchange={(e) =>
					set({ basis: (e.currentTarget as HTMLSelectElement).value as Rule['basis'] })}
			>
				<option value="all">Whole vote</option>
				<option value="cast">Votes cast</option>
			</select>
		</div>
		<div class="{row} px-4 py-3">
			<span class={label}>Threshold <Hint text={help.threshold} /></span>
			<div class="flex min-w-0 items-center gap-2">
				<select
					class="{select} flex-1"
					value={rule.threshold.kind}
					aria-label="{whose}: threshold"
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
					<option value="majority">More than half</option>
					<option value="fraction">Fraction</option>
					<option value="percent">Percentage</option>
				</select>
				{#if rule.threshold.kind === 'percent'}
					<Input
						type="number"
						min={1}
						max={100}
						class="w-20 shrink-0 text-right"
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
						class="w-14 shrink-0 px-2 text-right"
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
						class="w-14 shrink-0 px-2 text-right"
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
				<span class="font-mono text-xs text-ink-dim">% must take part (0 = none)</span>
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
					>{rule.changeable ? 'off while votes may change' : 'when the outcome is certain'}</span
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
	{/snippet}

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
		{#if collapsed}
			<details class="group/custom">
				<summary
					class="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-xs tracking-[0.14em] text-ink-mid uppercase hover:text-ink [&::-webkit-details-marker]:hidden"
				>
					Customise ballot and rule
					<span class="transition-transform group-open/custom:rotate-45" aria-hidden="true">+</span>
				</summary>
				<div class="divide-y divide-border border-t border-border">
					{@render ballot?.()}
					{@render dials()}
				</div>
			</details>
		{:else}
			{@render dials()}
		{/if}
		{#if rule.threshold.kind === 'fraction' && rule.threshold.num > rule.threshold.den}
			<p class="px-4 py-3 font-mono text-xs text-red">The fraction can't exceed 1.</p>
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
