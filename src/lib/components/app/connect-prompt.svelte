<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { store } from '$lib/wallet-store.svelte';

	let { what = 'see DAOs you participate in' }: { what?: string } = $props();
</script>

<div class="flex flex-col items-center gap-4 py-20 text-center">
	<div
		class="flex size-16 items-center justify-center border border-border bg-surface text-2xl text-ink-dim"
	>
		⬡
	</div>
	<p class="font-display text-[17px] font-bold">
		{store.hasKey ? 'Your wallet is locked' : 'Connect your wallet'}
	</p>
	<p class="text-[13px] text-ink-dim">
		This page is derived from your on-chain party.<br />
		{store.hasKey ? `Unlock it to ${what}.` : `Create or restore a key to ${what}.`}
	</p>
	<Button href="/wallet" class="mt-2">{store.hasKey ? 'Unlock wallet' : 'Connect wallet'}</Button>
</div>
