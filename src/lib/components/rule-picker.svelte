<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import Hint from './hint.svelte';
	import {
		PRESETS,
		presetOf,
		describe,
		standing,
		atLeast,
		type Preset,
		type Rule
	} from '$lib/rules';
	import { fmt } from '$lib/format';

	/**
	 * How a proposal passes: a preset for the arithmetic, or the three dials behind them; then
	 * two switches for time — settle early once the outcome is sure, or let voters change their
	 * minds until the deadline. The two cannot both be on: a result that is sure only while
	 * nobody changes their vote is not sure, so turning one on turns the other off and says so.
	 * Given the size of this DAO's vote, every option says what it comes to in numbers here.
	 * The rule travels in the form as hidden fields, so what is signed is what was picked.
	 */
	let {
		rule = $bindable(),
		eligible = 0,
		equal = false,
		floor,
		prefix = ''
	}: {
		rule: Rule;
		/** The whole vote today, in units; 0 when unknown. */
		eligible?: number;
		/** One member, one unit: units are people. */
		equal?: boolean;
		/** The DAO's own rule: nothing below it can be picked. */
		floor?: Rule;
		/** Field names in the form: `basis`, or `newBasis` with a prefix. */
		prefix?: string;
	} = $props();
	const field = (name: string) => (prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name);
	/** Whether a preset's arithmetic may be picked over the floor. */
	const allowed = (r: Rule) =>
		!floor || atLeast(floor, { ...r, early: floor.early, changeable: false });
	const minPercent = $derived(
		!floor ? 1 : floor.threshold.kind === 'percent' ? floor.threshold.percent : 51
	);
	const majorityAllowed = $derived(
		!floor || floor.threshold.kind === 'majority' || floor.threshold.percent <= 50
	);
	const arithmetic = (r: Rule) => ({ ...r, early: true, changeable: false });
	let preset = $state<Preset>(presetOf(arithmetic(rule)));
	const pick = (p: Preset) => {
		preset = p;
		const found = PRESETS.find((x) => x.value === p)?.rule;
		if (found)
			rule = {
				...found,
				threshold: { ...found.threshold },
				early: rule.early,
				changeable: rule.changeable
			};
	};
	const percent = $derived(rule.threshold.kind === 'percent' ? rule.threshold.percent : 67);
	const setEarly = (on: boolean) =>
		(rule = { ...rule, early: on, changeable: on ? false : rule.changeable });
	const setChangeable = (on: boolean) =>
		(rule = { ...rule, changeable: on, early: on ? false : rule.early });

	const unit = (n: number) => (equal ? (n === 1 ? 'member' : 'members') : 'units');
	/** What a rule comes to in this DAO, in one line; empty when the vote's size is unknown. */
	function here(r: Rule): string {
		if (eligible <= 0) return '';
		const of = `${fmt(eligible)} ${unit(eligible)}`;
		const quorum =
			r.quorum > 0
				? ` At least ${fmt(Math.ceil((eligible * r.quorum) / 100))} of ${of} must vote.`
				: '';
		if (r.basis === 'all') {
			const { needed } = standing(r, 0, 0, 0, eligible);
			return `Here: ${fmt(needed)} of ${of} must say yes.${quorum}`;
		}
		const amount =
			r.threshold.kind === 'majority' ? 'more yes than no' : `at least ${r.threshold.percent}% yes`;
		return `Here: ${amount} among those who vote.${quorum}`;
	}
	const explain: Record<Preset, string> = {
		majority:
			'Yes must come from more than half of the whole vote — everyone who could vote, not only those who did. Staying silent is as good as voting no. The usual rule for everyday decisions.',
		cast: 'Among those who vote, yes must beat no; an abstention takes part but takes no side. So that a handful cannot decide for everyone, at least a quarter of the whole vote must take part, or the proposal fails at the deadline.',
		twoThirds:
			'At least two thirds of the whole vote says yes. Silence counts against. For decisions that should not pass on a thin majority: money, membership, the rules themselves.',
		unanimous:
			'Every unit of the vote says yes. A single no, abstention or absence fails it — so it fails early, the moment one no is cast. For decisions everyone must stand behind.',
		custom:
			'Set the three parts yourself: what yes is measured against, how much yes it takes, and whether a minimum must take part at all. The line under the dials says what that comes to here.'
	};
	const dialHelp = {
		basis:
			'The whole vote: everyone who could vote is the denominator, so a member who stays silent counts as a no. The votes cast: only the yes and no actually cast count, so a few voters can decide — unless a quorum says how many must take part.',
		threshold:
			'More than half: strictly over 50% of the denominator; 50 of 100 is not enough, 51 is. A percentage: at least that share of the denominator; 100% means everyone.',
		quorum:
			'How much of the whole vote must take part — yes, no or abstain — for the result to count at all. Below it the proposal fails at the deadline whatever the yes count. 0 means no minimum. Matters most with "the votes cast".',
		early:
			'The proposal settles the moment its outcome can no longer change: yes has enough even if everyone still silent said no, or yes can no longer reach enough even if they all said yes. Otherwise it waits for the deadline.',
		changeable:
			'A voter may replace their ballot any number of times until the deadline. Because a vote may still change, ballots are counted only at the deadline, and nothing settles early.'
	};
</script>

<input type="hidden" name={field('basis')} value={rule.basis} />
<input type="hidden" name={field('threshold')} value={rule.threshold.kind} />
<input type="hidden" name="n:{field('percent')}" value={percent} />
<input type="hidden" name="n:{field('quorum')}" value={rule.quorum} />
<input type="hidden" name={field('early')} value={rule.early ? 'yes' : 'no'} />
<input type="hidden" name={field('changeable')} value={rule.changeable ? 'yes' : 'no'} />

<div class="space-y-4">
	<div class="grid gap-3 sm:grid-cols-2">
		{#each PRESETS as p, i (p.value)}
			{@const below = !!p.rule && !allowed(p.rule)}
			<label
				class="border p-4 transition-colors {below
					? 'cursor-not-allowed border-border opacity-50'
					: preset === p.value
						? 'cursor-pointer border-orange bg-orange/5'
						: 'cursor-pointer border-border hover:border-border-hover'}"
			>
				<input
					type="radio"
					class="sr-only"
					name={field('preset')}
					value={p.value}
					checked={preset === p.value}
					disabled={below}
					onchange={() => pick(p.value)}
				/>
				<span class="flex items-center gap-1.5 font-display text-[15px] font-bold"
					>{p.title} <Hint text={explain[p.value]} align={i % 2 ? 'end' : 'start'} /></span
				>
				<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{p.text}</span>
				{#if below}
					<span class="mt-1.5 block font-mono text-[0.6875rem] text-red">Below the DAO's rule.</span
					>
				{:else if p.rule && here(p.rule)}
					<span class="mt-1.5 block font-mono text-[0.6875rem] text-ink">{here(p.rule)}</span>
				{/if}
			</label>
		{/each}
	</div>

	{#if preset === 'custom'}
		<div class="space-y-4 border border-border p-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="space-y-1.5">
					<span
						class="flex items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase"
						>Yes measured against <Hint text={dialHelp.basis} /></span
					>
					<select
						class="block w-full border border-border bg-surface px-3 py-2 text-sm"
						bind:value={rule.basis}
					>
						<option value="all">the whole vote (silence counts as no)</option>
						{#if !floor || floor.basis === 'cast'}
							<option value="cast">the votes cast (yes and no only)</option>
						{/if}
					</select>
				</label>
				<label class="space-y-1.5">
					<span
						class="flex items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase"
						>It takes <Hint text={dialHelp.threshold} align="end" /></span
					>
					<select
						class="block w-full border border-border bg-surface px-3 py-2 text-sm"
						value={rule.threshold.kind}
						onchange={(e) =>
							(rule = {
								...rule,
								threshold:
									(e.currentTarget as HTMLSelectElement).value === 'percent'
										? { kind: 'percent', percent }
										: { kind: 'majority' }
							})}
					>
						{#if majorityAllowed}<option value="majority">more than half</option>{/if}
						<option value="percent">at least a percentage</option>
					</select>
				</label>
				{#if rule.threshold.kind === 'percent'}
					<label class="space-y-1.5">
						<span class="font-mono text-xs tracking-[0.14em] text-ink-dim uppercase"
							>Percent of yes</span
						>
						<Input
							type="number"
							min={minPercent}
							max={100}
							class="w-32"
							value={rule.threshold.percent}
							oninput={(e) =>
								(rule = {
									...rule,
									threshold: {
										kind: 'percent',
										percent: Number((e.currentTarget as HTMLInputElement).value)
									}
								})}
						/>
					</label>
				{/if}
				<label class="space-y-1.5">
					<span
						class="flex items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase"
						>Quorum, % of the vote <Hint text={dialHelp.quorum} /></span
					>
					<Input
						type="number"
						min={floor?.quorum ?? 0}
						max={100}
						class="w-32"
						bind:value={rule.quorum}
					/>
					<span class="block text-xs text-ink-dim"
						>Who must take part at all; abstentions count. 0 for none.</span
					>
				</label>
			</div>
			{#if floor && !atLeast(floor, rule)}
				<p class="font-mono text-xs text-red">
					This asks less than the DAO's rule; it will be refused.
				</p>
			{:else if here(rule)}
				<p class="font-mono text-xs text-ink">{here(rule)}</p>
			{/if}
		</div>
	{/if}

	<div class="grid gap-3 sm:grid-cols-2">
		<label
			class="flex cursor-pointer items-start gap-3 border p-3 text-sm transition-colors {rule.early
				? 'border-orange bg-orange/5'
				: 'border-border hover:border-border-hover'}"
		>
			<input
				type="checkbox"
				class="mt-0.5 accent-orange"
				checked={rule.early}
				disabled={!!floor && !floor.early}
				onchange={(e) => setEarly((e.currentTarget as HTMLInputElement).checked)}
			/>
			<span>
				<span class="flex items-center gap-1.5 font-display text-[14px] font-bold"
					>Settle early <Hint text={dialHelp.early} /></span
				>
				<span class="mt-0.5 block text-xs leading-relaxed text-ink-mid"
					>Decided the moment the outcome can no longer change, before the deadline.</span
				>
			</span>
		</label>
		<label
			class="flex cursor-pointer items-start gap-3 border p-3 text-sm transition-colors {rule.changeable
				? 'border-orange bg-orange/5'
				: 'border-border hover:border-border-hover'}"
		>
			<input
				type="checkbox"
				class="mt-0.5 accent-orange"
				checked={rule.changeable}
				onchange={(e) => setChangeable((e.currentTarget as HTMLInputElement).checked)}
			/>
			<span>
				<span class="flex items-center gap-1.5 font-display text-[14px] font-bold"
					>Votes may change <Hint text={dialHelp.changeable} align="end" /></span
				>
				<span class="mt-0.5 block text-xs leading-relaxed text-ink-mid"
					>A voter may replace their ballot until the deadline; counted only then.</span
				>
			</span>
		</label>
	</div>

	<p class="font-mono text-xs text-ink-dim">
		Passes when {describe(rule)}.
		{#if rule.early}Settles early once that is sure.{:else if rule.changeable}Votes may change, so
			it is decided at the deadline only.{:else}Decided at the deadline only.{/if}
	</p>
</div>
