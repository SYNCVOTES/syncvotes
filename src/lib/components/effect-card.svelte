<script lang="ts">
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';
	import { coin, fmt } from '$lib/format';

	/** What a proposal does when it passes, spelled out. */
	type Effect =
		| { kind: 'signal' }
		| { kind: 'payout'; to: string; amount: number }
		| { kind: 'members'; add: string[]; remove: string[] }
		| { kind: 'admins'; admins: string[] };
	let { effect, executedAt }: { effect: Effect; executedAt: string | null } = $props();
	const title: Record<Effect['kind'], string> = {
		signal: 'Signal',
		payout: 'Payout',
		members: 'Membership',
		admins: 'Admins'
	};
</script>

<Panel padding="sm" class="space-y-2">
	<h2 class="eyebrow">{title[effect.kind]}{executedAt ? ' · carried out' : ''}</h2>
	<div class="text-[13px] text-ink-mid">
		{#if effect.kind === 'signal'}
			Decides, and does nothing else.
		{:else if effect.kind === 'payout'}
			Pays <span class="font-mono text-ink">{coin(effect.amount)}</span> from the treasury to
			<PartyId party={effect.to} class="align-middle" />.
		{:else if effect.kind === 'members'}
			{#if effect.add.length}Adds {fmt(effect.add.length)}:
				<span class="inline-flex flex-wrap gap-1 align-middle">
					{#each effect.add as p (p)}<PartyId party={p} />{/each}
				</span>{/if}
			{#if effect.remove.length}Removes {fmt(effect.remove.length)}:
				<span class="inline-flex flex-wrap gap-1 align-middle">
					{#each effect.remove as p (p)}<PartyId party={p} />{/each}
				</span>{/if}
		{:else}
			Makes the admins exactly:
			<span class="inline-flex flex-wrap gap-1 align-middle">
				{#each effect.admins as p (p)}<PartyId party={p} />{/each}
			</span>
		{/if}
	</div>
</Panel>
