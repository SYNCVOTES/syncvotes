<script lang="ts">
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';
	import { fmt } from '$lib/format';

	/** What a proposal does when it passes, spelled out. */
	type Effect = { kind: 'signal' } | { kind: 'members'; add: string[]; remove: string[] };
	let { effect, executedAt }: { effect: Effect; executedAt: string | null } = $props();
</script>

<Panel padding="sm" class="space-y-2">
	<h2 class="eyebrow">Membership{executedAt ? ' · carried out' : ''}</h2>
	<div class="text-[13px] text-ink-mid">
		{#if effect.kind === 'members'}
			{#if effect.add.length}Adds {fmt(effect.add.length)}:
				<span class="inline-flex flex-wrap gap-1 align-middle">
					{#each effect.add as p (p)}<PartyId party={p} />{/each}
				</span>{/if}
			{#if effect.remove.length}Removes {fmt(effect.remove.length)}:
				<span class="inline-flex flex-wrap gap-1 align-middle">
					{#each effect.remove as p (p)}<PartyId party={p} />{/each}
				</span>{/if}
		{:else}
			Decides, and does nothing else.
		{/if}
	</div>
</Panel>
