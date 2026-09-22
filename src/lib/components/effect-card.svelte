<script lang="ts">
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';
	import { fmt } from '$lib/format';

	/** What a proposal does when it passes, spelled out — and, for membership, the before and after. */
	type Effect =
		| { kind: 'signal' }
		| { kind: 'members'; add: string[]; remove: string[] }
		| { kind: 'info'; name: string; description: string }
		| { kind: 'dissolve' };
	let {
		effect,
		executedAt,
		members
	}: { effect: Effect; executedAt: string | null; members: number } = $props();
	const title: Record<Effect['kind'], string> = {
		signal: 'Decision',
		members: 'Membership',
		info: 'Name and description',
		dissolve: 'Dissolution'
	};
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">{title[effect.kind]}{executedAt ? ' · carried out' : ''}</h2>
	{#if effect.kind === 'members'}
		<div class="grid gap-3 sm:grid-cols-2">
			{#if effect.add.length}
				<div>
					<div class="mb-1 font-mono text-xs text-green">Join ({fmt(effect.add.length)})</div>
					<ul class="space-y-1">
						{#each effect.add as p (p)}<li><PartyId party={p} /></li>{/each}
					</ul>
				</div>
			{/if}
			{#if effect.remove.length}
				<div>
					<div class="mb-1 font-mono text-xs text-red">Leave ({fmt(effect.remove.length)})</div>
					<ul class="space-y-1">
						{#each effect.remove as p (p)}<li><PartyId party={p} /></li>{/each}
					</ul>
				</div>
			{/if}
		</div>
		<p class="font-mono text-xs text-ink-dim">
			{#if executedAt}
				{fmt(members)} members now.
			{:else}
				{fmt(members)} members now, {fmt(members + effect.add.length - effect.remove.length)} after.
			{/if}
		</p>
	{:else if effect.kind === 'info'}
		<div class="text-[13px] text-ink-mid">
			Renames the DAO to <span class="font-display font-bold text-ink">{effect.name}</span
			>{effect.description
				? ` and describes it as: ${effect.description}`
				: ' and clears its description'}.
		</div>
	{:else if effect.kind === 'dissolve'}
		<p class="text-[13px] text-ink-mid">
			Dissolves the DAO once every other vote has settled. Its settled proposals stay readable;
			nothing new can be proposed.
		</p>
	{:else}
		<p class="text-[13px] text-ink-mid">Decides, and does nothing else.</p>
	{/if}
</Panel>
