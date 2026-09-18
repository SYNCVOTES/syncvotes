<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	/** The DAO's treasury at a glance; the treasury page has the rest. */
	let {
		dao,
		admin,
		treasury
	}: {
		dao: string;
		admin: boolean;
		treasury: { party: string; signers: string[]; threshold: number } | null;
	} = $props();
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">Treasury</h2>
	{#if treasury}
		<p class="text-[13px] text-ink-mid">
			A party the admins own together; {treasury.threshold} of {treasury.signers.length} sign a payout.
			Funded by anyone who sends it coin.
		</p>
		<PartyId party={treasury.party} size="md" />
	{:else}
		<p class="text-[13px] text-ink-dim">
			None yet. {admin
				? 'Build one: every admin signs its identity, then the DAO can hold and pay out coin.'
				: 'An admin can build one.'}
		</p>
	{/if}
	<Button href="/daos/{dao}/treasury" variant="outline" size="sm" class="w-full">
		{treasury ? 'Open treasury' : admin ? 'Build a treasury' : 'About the treasury'}
		<ArrowRight size={14} />
	</Button>
</Panel>
