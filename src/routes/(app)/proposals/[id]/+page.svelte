<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import UnlockForm from '$lib/components/app/unlock-form.svelte';
	import { relative } from '$lib/format';

	const id = $derived(page.params.id!);
	const proposal = $derived(remote.proposal(id));
	const me = $derived(store.who?.party ?? null);
	const nameOf = (party: string) => proposal.current?.names[party] ?? party.split('::')[0];

	// A vote or a close archives this contract and creates the next one, so the page follows —
	// and the DAO's counts and the member's list moved with it.
	async function act(
		what: (signer: Parameters<typeof actions.vote>[0], who: actions.Identity) => Promise<void>
	) {
		const ok = await flow.act(what);
		if (!ok) return;
		const dao = proposal.current?.dao;
		await Promise.all([
			proposal.refresh(),
			dao ? remote.dao(dao).refresh() : null,
			me ? remote.myDaos(me).refresh() : null
		]);
	}
</script>

<svelte:head><title>{proposal.current?.title ?? 'Proposal'} — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[900px] px-6 py-12 md:px-10">
	{#if proposal.error}
		<Problem message={describe(proposal.error)} />
	{:else if !proposal.ready}
		<div class="h-40 animate-pulse border border-border bg-surface"></div>
	{:else}
		{@const p = proposal.current}
		{@const yes = p.ballots.filter((b) => b.vote === 'Yes').length}
		{@const no = p.ballots.filter((b) => b.vote === 'No').length}
		{@const n = p.members.length}
		{@const needed = Math.floor(n / 2) + 1}
		{@const ended = new Date(p.closesAt).getTime() < Date.now()}
		{@const settled = yes >= needed || n - no < needed}
		{@const member = me !== null && p.members.includes(me)}
		{@const voted = me !== null && p.ballots.some((b) => b.voter === me)}

		<a href="/daos/{p.dao}" class="eyebrow hover:text-orange">← {p.daoName}</a>

		<div class="mt-6 mb-8">
			<div class="mb-3 flex items-center gap-3">
				<StatusBadge outcome={p.outcome} closesAt={p.closesAt} />
				<span class="font-mono text-xs text-ink-dim">
					{p.outcome
						? 'closed'
						: ended
							? `ended ${relative(p.closesAt)}`
							: `closes ${relative(p.closesAt)}`}
				</span>
			</div>
			<h1 class="display text-3xl md:text-4xl">{p.title}</h1>
			<p class="mt-2 font-mono text-xs text-ink-dim">Proposed by {nameOf(p.proposer)}</p>
		</div>

		<Problem message={store.problem} />

		<div class="grid gap-8 lg:grid-cols-[1fr_320px]">
			<section class="space-y-8">
				<div
					class="border border-border bg-surface p-6 text-sm leading-relaxed whitespace-pre-wrap"
				>
					{p.description || 'No description.'}
				</div>

				<div>
					<h2 class="eyebrow mb-4">Ballots</h2>
					{#if p.ballots.length === 0}
						<p class="text-[13px] text-ink-dim">No votes yet.</p>
					{:else}
						<ul class="divide-y divide-border border border-border bg-surface">
							{#each p.ballots as b (b.voter)}
								<li class="flex items-center justify-between px-4 py-3 font-mono text-xs">
									<span class={b.voter === me ? 'text-orange' : ''}>{nameOf(b.voter)}</span>
									<span class={b.vote === 'Yes' ? 'text-green' : 'text-red'}>{b.vote}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</section>

			<aside class="space-y-6">
				<div class="border border-border bg-surface p-5">
					<h2 class="eyebrow mb-4">Tally</h2>
					<div class="mb-2 flex h-2 overflow-hidden bg-surface-active">
						<div class="bg-green" style="width: {(yes / n) * 100}%"></div>
						<div class="bg-red" style="width: {(no / n) * 100}%"></div>
					</div>
					<div class="flex justify-between font-mono text-xs">
						<span class="text-green">{yes} yes</span>
						<span class="text-ink-dim">{needed} of {n} to pass</span>
						<span class="text-red">{no} no</span>
					</div>
				</div>

				{#if p.outcome}
					<div class="border border-border bg-surface p-5 font-mono text-xs text-ink-mid">
						Closed as <span class={p.outcome === 'Passed' ? 'text-green' : 'text-red'}
							>{p.outcome}</span
						>.
					</div>
				{:else if store.screen.at === 'locked'}
					<div class="space-y-3 border border-border bg-surface p-5">
						<p class="text-[13px] text-ink-dim">Unlock your wallet to vote.</p>
						<UnlockForm />
					</div>
				{:else if !store.who}
					<div class="border border-border bg-surface p-5 text-[13px] text-ink-dim">
						<a href="/wallet" class="text-orange hover:underline">Connect a wallet</a> to vote.
					</div>
				{:else if !member}
					<div class="border border-border bg-surface p-5 text-[13px] text-ink-dim">
						Only members can vote.
					</div>
				{:else}
					<div class="space-y-3 border border-border bg-surface p-5">
						{#if !voted && !ended}
							<div class="grid grid-cols-2 gap-3">
								<Button
									variant="accent"
									disabled={store.busy}
									onclick={() => act((s, w) => actions.vote(s, w, p.contractId, 'Yes'))}>Yes</Button
								>
								<Button
									variant="destructive"
									disabled={store.busy}
									onclick={() => act((s, w) => actions.vote(s, w, p.contractId, 'No'))}>No</Button
								>
							</div>
						{:else if voted}
							<p class="font-mono text-xs text-ink-dim">You voted.</p>
						{/if}
						{#if settled || ended}
							<Button
								variant="outline"
								class="w-full"
								disabled={store.busy}
								onclick={() => act((s, w) => actions.close(s, w, p.contractId))}
							>
								Close proposal
							</Button>
							<p class="text-xs text-ink-dim">
								{settled ? 'The outcome is settled.' : 'The deadline has passed.'}
							</p>
						{/if}
					</div>
				{/if}
			</aside>
		</div>
	{/if}
</div>
