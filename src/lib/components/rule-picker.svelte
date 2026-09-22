<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { PRESETS, presetOf, describe, type Preset, type Rule } from '$lib/rules';

	/**
	 * How a proposal passes: a preset for the arithmetic, or the three dials behind them; then
	 * two switches for time — settle early once the outcome is sure, or let voters change their
	 * minds until the deadline. The two cannot both be on: a result that is sure only while
	 * nobody changes their vote is not sure, so turning one on turns the other off and says so.
	 * The rule travels in the form as hidden fields, so what is signed is what was picked.
	 */
	let { rule = $bindable() }: { rule: Rule } = $props();
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
</script>

<input type="hidden" name="basis" value={rule.basis} />
<input type="hidden" name="threshold" value={rule.threshold.kind} />
<input type="hidden" name="n:percent" value={percent} />
<input type="hidden" name="n:quorum" value={rule.quorum} />
<input type="hidden" name="early" value={rule.early ? 'yes' : 'no'} />
<input type="hidden" name="changeable" value={rule.changeable ? 'yes' : 'no'} />

<div class="space-y-4">
	<div class="grid gap-3 sm:grid-cols-2">
		{#each PRESETS as p (p.value)}
			<label
				class="cursor-pointer border p-4 transition-colors {preset === p.value
					? 'border-orange bg-orange/5'
					: 'border-border hover:border-border-hover'}"
			>
				<input
					type="radio"
					class="sr-only"
					name="preset"
					value={p.value}
					checked={preset === p.value}
					onchange={() => pick(p.value)}
				/>
				<span class="block font-display text-[15px] font-bold">{p.title}</span>
				<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{p.text}</span>
			</label>
		{/each}
	</div>

	{#if preset === 'custom'}
		<div class="grid gap-4 border border-border p-4 sm:grid-cols-2">
			<label class="space-y-1.5">
				<span class="font-mono text-xs tracking-[0.14em] text-ink-dim uppercase"
					>Yes measured against</span
				>
				<select
					class="block w-full border border-border bg-surface px-3 py-2 text-sm"
					bind:value={rule.basis}
				>
					<option value="all">the whole vote</option>
					<option value="cast">the votes cast</option>
				</select>
			</label>
			<label class="space-y-1.5">
				<span class="font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">It takes</span>
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
					<option value="majority">more than half</option>
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
						min={1}
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
				<span class="font-mono text-xs tracking-[0.14em] text-ink-dim uppercase"
					>Quorum, % of the vote</span
				>
				<Input type="number" min={0} max={100} class="w-32" bind:value={rule.quorum} />
				<span class="block text-xs text-ink-dim"
					>Who must take part at all; abstentions count. 0 for none.</span
				>
			</label>
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
				onchange={(e) => setEarly((e.currentTarget as HTMLInputElement).checked)}
			/>
			<span>
				<span class="block font-display text-[14px] font-bold">Settle early</span>
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
				<span class="block font-display text-[14px] font-bold">Votes may change</span>
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
