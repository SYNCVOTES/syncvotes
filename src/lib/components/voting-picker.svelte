<script lang="ts">
	import { Input } from '$lib/components/ui/input';

	/** How the DAO decides: one member, one vote — or by coin locked in each voter's wallet. */
	let {
		voting = $bindable('member'),
		quorum = $bindable(0)
	}: {
		voting: 'member' | 'stake';
		quorum: number;
	} = $props();
	const options = [
		{
			value: 'member' as const,
			title: 'By member',
			text: 'One member, one vote. A proposal passes once a majority of all members said yes, fails once that is out of reach, and is decided by the ballots cast at the deadline.'
		},
		{
			value: 'stake' as const,
			title: 'By stake',
			text: 'Votes weigh what the voter has locked in their own wallet past the deadline, in Canton Coin. Nothing moves and nobody holds it. Decided at the deadline: yes must outweigh no.'
		}
	];
</script>

<div class="space-y-3">
	<div class="grid gap-3 sm:grid-cols-2">
		{#each options as o (o.value)}
			<label
				class="cursor-pointer border p-4 transition-colors {voting === o.value
					? 'border-orange bg-orange/5'
					: 'border-border hover:border-border-hover'}"
			>
				<input type="radio" class="sr-only" value={o.value} bind:group={voting} />
				<div class="font-display text-[15px] font-bold">{o.title}</div>
				<p class="mt-1 text-xs leading-relaxed text-ink-mid">{o.text}</p>
			</label>
		{/each}
	</div>
	{#if voting === 'stake'}
		<label class="block space-y-1.5">
			<span class="font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">Quorum, in CC</span>
			<Input type="number" min={0} step="any" class="w-40" bind:value={quorum} />
			<span class="block text-xs text-ink-dim"
				>Coin that must take part for a vote to count. Zero for none.</span
			>
		</label>
	{/if}
</div>
