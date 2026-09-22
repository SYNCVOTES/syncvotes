<script lang="ts">
	import { hintOf } from '$lib/format';

	/** The vote as a bar: a segment per member, the width its share, the widest few labelled. */
	let { members, me }: { members: { party: string; share: number }[]; me: string | null } =
		$props();
	const sorted = $derived([...members].sort((a, b) => b.share - a.share));
</script>

<div class="space-y-2">
	<div class="flex h-3 overflow-hidden bg-surface-active">
		{#each sorted as m, i (m.party)}
			<div
				class={m.party === me ? 'bg-orange' : i % 2 ? 'bg-ink-dim' : 'bg-ink-mid'}
				style="width: {m.share}%"
				title="{hintOf(m.party)}: {m.share}%"
			></div>
		{/each}
	</div>
	<div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-dim">
		{#each sorted.slice(0, 6) as m (m.party)}
			<span class={m.party === me ? 'text-orange' : ''}>{hintOf(m.party)} {m.share}%</span>
		{/each}
		{#if sorted.length > 6}<span>+{sorted.length - 6} more</span>{/if}
	</div>
</div>
