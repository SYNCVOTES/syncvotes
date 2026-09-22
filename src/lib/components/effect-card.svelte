<script lang="ts">
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';

	/**
	 * What a proposal does when it passes, spelled out — for a share table, who gains, who
	 * loses, who joins and who leaves, against the table of today.
	 */
	type Effect =
		| { kind: 'signal' }
		| { kind: 'shares'; shares: { party: string; share: number }[] }
		| { kind: 'info'; name: string; description: string }
		| { kind: 'dissolve' };
	let {
		effect,
		executedAt,
		current
	}: { effect: Effect; executedAt: string | null; current: { party: string; share: number }[] } =
		$props();
	const title: Record<Effect['kind'], string> = {
		signal: 'Decision',
		shares: 'Shares of the vote',
		info: 'Name and description',
		dissolve: 'Dissolution'
	};
	const diff = $derived.by(() => {
		if (effect.kind !== 'shares') return [];
		const now = new Map(current.map((m) => [m.party, m.share]));
		const after = new Map(effect.shares.map((s) => [s.party, s.share]));
		const parties = [...new Set([...now.keys(), ...after.keys()])];
		return parties
			.map((party) => ({ party, from: now.get(party) ?? null, to: after.get(party) ?? null }))
			.sort((a, b) => (b.to ?? 0) - (a.to ?? 0));
	});
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">{title[effect.kind]}{executedAt ? ' · carried out' : ''}</h2>
	{#if effect.kind === 'shares'}
		<ul class="divide-y divide-border">
			{#each diff as d (d.party)}
				<li class="flex items-center gap-3 py-1.5 font-mono text-xs">
					<PartyId party={d.party} class="min-w-0 flex-1" />
					{#if d.from === null}
						<span class="text-green">joins with {d.to}%</span>
					{:else if d.to === null}
						<span class="text-red">leaves ({d.from}%)</span>
					{:else if d.from !== d.to}
						<span class="text-ink-dim">{d.from}%</span><span class="text-ink-dim">→</span><span
							class={d.to > d.from ? 'text-green' : 'text-red'}>{d.to}%</span
						>
					{:else}
						<span class="text-ink-dim">{d.to}%</span>
					{/if}
				</li>
			{/each}
		</ul>
		{#if executedAt}<p class="font-mono text-xs text-ink-dim">This is the table now.</p>{/if}
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
