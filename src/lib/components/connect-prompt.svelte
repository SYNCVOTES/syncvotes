<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { store } from '$lib/wallet-store.svelte';
	import UnlockForm from './unlock-form.svelte';
	import Problem from './problem.svelte';
	import StateMessage from './state-message.svelte';
	import Lock from '@lucide/svelte/icons/lock';

	let { what = 'see your DAOs' }: { what?: string } = $props();
	const locked = $derived(store.screen.at === 'locked');
</script>

<StateMessage icon={Lock} title={locked ? 'Wallet locked' : 'Sign in to continue'}>
	{locked ? `Unlock it to ${what}.` : `Create or restore a key to ${what}.`}
	{#snippet actions()}
		{#if locked}
			<Problem message={store.problem} />
			<UnlockForm />
		{:else}
			<Button href="/app/wallet">Go to Wallet</Button>
		{/if}
	{/snippet}
</StateMessage>
