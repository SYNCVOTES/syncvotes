<script lang="ts">
	import { hintOf } from '$lib/format';

	/**
	 * The vote as a bar: a segment per member, the width its share of `units`, the widest few
	 * labelled. Given a page of the biggest holders, the rest is one grey remainder.
	 */
	let {
		members,
		units,
		me
	}: {
		members: { party: string; share: number; who?: { name: string | null } }[];
		units: number;
		me: string | null;
	} = $props();
	const sorted = $derived([...members].sort((a, b) => b.share - a.share));
	const pct = (n: number) => (units > 0 ? Math.round((n / units) * 1000) / 10 : 0);
	const rest = $derived(Math.max(0, units - sorted.reduce((s, m) => s + m.share, 0)));
	const label = (m: { party: string; who?: { name: string | null } }) =>
		m.who?.name || hintOf(m.party);
</script>

<div class="space-y-2">
	<div class="flex h-3 overflow-hidden bg-surface-active">
		{#each sorted as m, i (m.party)}
			<div
				class={m.party === me ? 'bg-orange' : i % 2 ? 'bg-ink-dim' : 'bg-ink-mid'}
				style="width: {pct(m.share)}%"
				title="{label(m)}: {pct(m.share)}%"
			></div>
		{/each}
		{#if rest > 0}<div
				class="bg-surface-hover"
				style="width: {pct(rest)}%"
				title="others: {pct(rest)}%"
			></div>{/if}
	</div>
	<div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-dim">
		{#each sorted.slice(0, 6) as m (m.party)}
			<span class={m.party === me ? 'text-orange' : ''}>{label(m)} {pct(m.share)}%</span>
		{/each}
		{#if rest > 0}<span>others {pct(rest)}%</span>{/if}
	</div>
</div>
