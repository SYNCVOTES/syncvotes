<script lang="ts">
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import PartyId from './party-id.svelte';
	import Problem from './problem.svelte';
	import Hint from './hint.svelte';
	import Loader from '@lucide/svelte/icons/loader';
	import { coin } from '$lib/format';

	/**
	 * What the party holds in Canton Coin, and what was sent to it and waits for its word: a
	 * payout from a DAO lands here as a transfer to accept, signed with the party's own key.
	 */
	let incoming = $state<Awaited<ReturnType<typeof remote.incoming>> | null>(null);
	let problem = $state<string | null>(null);
	let accepting = $state<string | null>(null);
	async function load() {
		try {
			incoming = await remote.incoming();
			problem = null;
		} catch (e) {
			problem = e instanceof Error ? e.message : String(e);
		}
	}
	$effect(() => {
		if (!store.who) return;
		void load();
		const t = setInterval(() => void load(), 30_000);
		return () => clearInterval(t);
	});
	async function accept(cid: string) {
		accepting = cid;
		try {
			const ok = await flow.act((s, w) => actions.acceptTransfer(s, w, cid));
			if (ok) await load();
		} finally {
			accepting = null;
		}
	}
</script>

<div class="space-y-3">
	<h2 class="eyebrow flex items-center gap-1.5">
		Coin <Hint
			text="Canton Coin this party holds, and transfers sent to it that wait for its acceptance — a DAO's payout to you arrives this way. Accepting is a transaction signed with your key; unaccepted, a transfer returns to its sender after a while."
		/>
	</h2>
	{#if incoming}
		<div class="font-mono text-2xl font-bold">{coin(incoming.held)}</div>
		{#if incoming.pending.length}
			<ul class="divide-y divide-border border border-border">
				{#each incoming.pending as p (p.cid)}
					<li class="flex flex-wrap items-center gap-3 px-3 py-2 font-mono text-xs">
						<span class="text-ink">{coin(p.amount)}</span>
						<span class="text-ink-dim">from</span>
						<PartyId party={p.sender} class="min-w-0 flex-1" />
						<Button size="sm" disabled={store.busy} onclick={() => accept(p.cid)}>
							{#if accepting === p.cid}<Loader size={12} class="animate-spin" />{/if}Accept
						</Button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-xs text-ink-dim">Nothing waiting to be accepted.</p>
		{/if}
		<Problem message={store.problem ?? problem} />
	{:else if problem}
		<Problem message={problem} />
	{:else}
		<p class="font-mono text-xs text-ink-dim">Reading…</p>
	{/if}
</div>
