<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import PartyChips from './party-chips.svelte';
	import { fmt } from '$lib/format';

	/** Members to add to a DAO: chips, checked against the registry and the DAO, and a button. */
	let {
		dao,
		busy = false,
		onadd
	}: { dao: string; busy?: boolean; onadd: (parties: string[]) => Promise<boolean> } = $props();

	let parties = $state<string[]>([]);
	let checking = $state(false);
	let chips: PartyChips | undefined = $state();
</script>

<div class="space-y-3">
	<PartyChips {dao} {busy} bind:parties bind:checking bind:this={chips} />
	<Button
		disabled={busy || parties.length === 0 || checking}
		onclick={async () => {
			if (await onadd(parties)) chips?.settle();
		}}
	>
		{parties.length === 0
			? 'Add members'
			: `Add ${fmt(parties.length)} ${parties.length === 1 ? 'member' : 'members'}`}
	</Button>
</div>
