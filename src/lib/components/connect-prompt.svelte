<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { store } from '$lib/wallet-store.svelte';
	import UnlockForm from './unlock-form.svelte';
	import Problem from './problem.svelte';
	import Lock from '@lucide/svelte/icons/lock';

	let { what = 'see DAOs you participate in' }: { what?: string } = $props();
	const locked = $derived(store.screen.at === 'locked');
</script>

<div class="flex flex-col items-center gap-4 py-20 text-center">
	<div
		class="flex size-16 items-center justify-center border border-border bg-surface text-ink-dim"
	>
		<Lock size={22} strokeWidth={1.6} aria-hidden="true" />
	</div>
	<p class="font-display text-[17px] font-bold">
		{locked ? 'Your wallet is locked' : 'Connect your wallet'}
	</p>
	<p class="text-[13px] text-ink-dim">
		This page is derived from your on-chain party.<br />
		{locked ? `Unlock it to ${what}.` : `Create or restore a key to ${what}.`}
	</p>
	{#if locked}
		<div class="mt-2 flex w-full max-w-sm flex-col items-center gap-3">
			<Problem message={store.problem} />
			<UnlockForm />
		</div>
	{:else}
		<Button href="/wallet" class="mt-2">Connect wallet</Button>
	{/if}
</div>
