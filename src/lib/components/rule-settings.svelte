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
		type Settings
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
		equal = false
	}: { settings: Settings; prefix: string; eligible?: number; equal?: boolean } = $props();

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
		return `Here: ${rule.threshold.kind === 'majority' ? 'more yes than no' : `at least ${rule.threshold.percent}% yes`} among those who vote.${quorum}`;
	});
	const help = {
		preset:
			'A starting point for the three dials below. Majority of the vote: more than half of everyone who could vote. Majority of votes cast: more yes than no among those who vote, a quarter taking part. Two thirds and unanimous: of the whole vote. Move any dial and it becomes custom.',
		basis:
			'The whole vote: everyone who could vote is the denominator, so a member who stays silent counts as a no. The votes cast: only the yes and no actually cast count, so a few voters can decide unless a quorum says how many must take part.',
		threshold:
			'More than half: strictly over 50% of the denominator; 50 of 100 is not enough, 51 is. A percentage: at least that share of the denominator; 100% means everyone.',
		quorum:
			'How much of the whole vote must take part, yes, no or abstain, for the result to count at all. Below it the proposal fails at the deadline whatever the yes count. 0 means no minimum. Matters most with "the votes cast".',
		early:
			'The proposal settles the moment its outcome can no longer change: yes has enough even if everyone still silent said no, or yes can no longer reach enough even if they all said yes. Otherwise it waits for the deadline.',
		changeable:
			'A voter may replace their ballot any number of times until the deadline. Because a vote may still change, ballots are counted only at the deadline, and nothing settles early. The two switches exclude each other.',
		days: 'How long a vote is open from the moment the proposal is signed, in days: 1 to 90.'
	};
	const row = 'grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]';
	const label =
		'flex items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase';
	const select = 'block w-full border border-border bg-surface px-3 py-2 text-sm';
</script>

<input type="hidden" name="{prefix}Basis" value={rule.basis} />
<input type="hidden" name="{prefix}Threshold" value={rule.threshold.kind} />
<input type="hidden" name="n:{prefix}Percent" value={percent} />
<input type="hidden" name="n:{prefix}Quorum" value={rule.quorum} />
<input type="hidden" name="{prefix}Early" value={rule.early ? 'yes' : 'no'} />
<input type="hidden" name="{prefix}Changeable" value={rule.changeable ? 'yes' : 'no'} />
<input type="hidden" name="n:{prefix}Days" value={settings.votingDays} />

<div class="divide-y divide-border border border-border">
	<div class="{row} px-4 py-3">
		<span class={label}>Start from <Hint text={help.preset} /></span>
		<select
			class={select}
			value={preset}
			aria-label="{prefix} preset"
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
			<option value="all">the whole vote (silence counts as no)</option>
			<option value="cast">the votes cast (yes and no only)</option>
		</select>
	</div>
	<div class="{row} px-4 py-3">
		<span class={label}>It takes <Hint text={help.threshold} /></span>
		<div class="flex items-center gap-2">
			<select
				class={select}
				value={rule.threshold.kind}
				onchange={(e) =>
					set({
						threshold:
							(e.currentTarget as HTMLSelectElement).value === 'percent'
								? { kind: 'percent', percent }
								: { kind: 'majority' }
					})}
			>
				<option value="majority">more than half</option>
				<option value="percent">at least</option>
			</select>
			{#if rule.threshold.kind === 'percent'}
				<Input
					type="number"
					min={1}
					max={100}
					class="w-24 text-right"
					aria-label="Percent of yes"
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
				aria-label="Quorum"
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
				aria-label="{prefix} settle early"
				checked={rule.early}
				onchange={(e) => {
					const on = (e.currentTarget as HTMLInputElement).checked;
					set({ early: on, changeable: on ? false : rule.changeable });
				}}
			/>
			<span class="text-ink-mid">the moment the outcome can no longer change</span>
		</label>
	</div>
	<div class="{row} px-4 py-3">
		<span class={label}>Votes may change <Hint text={help.changeable} /></span>
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				class="accent-orange"
				aria-label="{prefix} votes may change"
				checked={rule.changeable}
				onchange={(e) => {
					const on = (e.currentTarget as HTMLInputElement).checked;
					set({ changeable: on, early: on ? false : rule.early });
				}}
			/>
			<span class="text-ink-mid">until the deadline; counted only then</span>
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
				aria-label="{prefix} voting days"
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
	<p class="px-4 py-3 font-mono text-xs text-ink">
		Passes when {describe(rule)}; {rule.early
			? 'settles early once sure'
			: rule.changeable
				? 'votes may change, decided at the deadline'
				: 'decided at the deadline'}. {here}
	</p>
</div>
