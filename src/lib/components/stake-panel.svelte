<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Panel from './panel.svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { coin, dateOf } from '$lib/format';

	/** In a stake DAO: what the signed-in member has locked, which is what their vote weighs. */
	let locked = $state<{ amount: number; until: string }[] | null>(null);
	$effect(() => {
		if (!store.who) return;
		const q = remote.myHoldings();
		q.refresh()
			.then(() => q)
			.then(
				({ holdings }) =>
					(locked = holdings
						.filter((h) => h.lock)
						.map((h) => ({ amount: h.amount, until: h.lock!.expiresAt }))),
				() => (locked = [])
			);
	});
	const total = $derived(locked?.reduce((s, l) => s + l.amount, 0) ?? 0);
	const latest = $derived(
		locked
			?.map((l) => l.until)
			.sort()
			.pop()
	);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">Your stake</h2>
	{#if locked === null}
		<p class="font-mono text-xs text-ink-dim">Reading your wallet…</p>
	{:else if locked.length === 0}
		<p class="text-[13px] text-ink-dim">
			Nothing locked. Votes here weigh coin locked in your wallet past a proposal's deadline.
		</p>
	{:else}
		<div class="font-mono text-2xl font-bold">{coin(total)}</div>
		<p class="font-mono text-xs text-ink-dim">
			locked{latest ? `, the last of it until ${dateOf(latest)}` : ''}
		</p>
	{/if}
	<Button href="/wallet" variant="outline" size="sm" class="w-full">
		Lock coin <ArrowRight size={14} />
	</Button>
</Panel>
