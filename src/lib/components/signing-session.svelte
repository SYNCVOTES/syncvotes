<script lang="ts">
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';
	import { coin } from '$lib/format';

	/**
	 * A treasury transaction gathering its signatures: who signed, how many it takes, how long
	 * the network still gives it. A signer sees the transaction checked against the intent
	 * before their key touches it.
	 */
	type Session = {
		id: string;
		intent:
			| { kind: 'approve'; proposal: string }
			| { kind: 'payout'; due: string; to: string; amount: number }
			| { kind: 'move'; to: string; amount: number };
		signed: string[];
		threshold: number;
		expiresAt: string;
		done: boolean;
		problem: string | null;
		prepared: actions.Prepared;
	};
	let { session, treasury, signer }: { session: Session; treasury: string; signer: boolean } =
		$props();

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});
	const left = $derived(
		Math.max(0, Math.round((new Date(session.expiresAt).getTime() - now) / 1000))
	);
	const me = $derived(store.who?.party ?? '');
	const sign = () => flow.act((s) => actions.signSession(s, treasury, session));
</script>

<Panel padding="sm" class="space-y-2">
	<div class="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
		<span class="text-ink">
			{#if session.intent.kind === 'approve'}Open to deposits
			{:else if session.intent.kind === 'payout'}Pay {coin(session.intent.amount)}
			{:else}Move {coin(session.intent.amount)}{/if}
		</span>
		{#if session.done}<span class="text-green">executed</span>
		{:else if left === 0}<span class="text-ink-dim">expired — open it again</span>
		{:else}<span class="text-ink-dim"
				>{session.signed.length} of {session.threshold} signed · {left}s left</span
			>{/if}
	</div>
	{#if session.intent.kind !== 'approve'}
		<div class="flex items-center gap-2 font-mono text-xs text-ink-dim">
			to <PartyId party={session.intent.to} />
		</div>
	{/if}
	<div class="flex flex-wrap gap-2">
		{#each session.signed as p (p)}<PartyId party={p} class="text-green" />{/each}
	</div>
	{#if session.problem}<p class="text-[13px] text-red">{session.problem}</p>{/if}
	{#if !session.done && left > 0 && signer && !session.signed.includes(me)}
		<Button size="sm" disabled={store.busy} onclick={sign}>Sign</Button>
	{/if}
</Panel>
