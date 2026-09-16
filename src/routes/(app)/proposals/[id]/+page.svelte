<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import Problem from '$lib/components/problem.svelte';
	import UnlockForm from '$lib/components/unlock-form.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Note from '$lib/components/note.svelte';
	import Tally from '$lib/components/tally.svelte';
	import SectionTitle from '$lib/components/section-title.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import DangerZone from '$lib/components/danger-zone.svelte';
	import { relative } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const proposal = $derived(me ? remote.proposal(id) : null);

	const nameOf = (party: string) => proposal?.current?.names[party] ?? party.split('::')[0];

	// The stream brings the new contract the moment the vote lands; nothing to refresh by hand.
	const vote = (contractId: string, choice: 'Yes' | 'No') =>
		flow.act((s, w) => actions.vote(s, w, contractId, choice));

	async function cancel(contractId: string, dao: string) {
		const ok = await flow.act((s, w) => actions.cancelProposal(s, w, contractId));
		if (ok) await goto(`/daos/${dao}`);
	}
</script>

<svelte:head><title>{proposal?.current?.title ?? 'Proposal'} — SyncVotes</title></svelte:head>

<Page
	back={proposal?.current
		? { href: `/daos/${proposal.current.daoId}`, label: proposal.current.daoName }
		: undefined}
>
	{#if !proposal}
		<ConnectPrompt what="see this proposal" />
	{:else if proposal.error}
		<Problem message={describe(proposal.error)} />
	{:else if !proposal.ready}
		<Skeleton />
	{:else}
		{@const p = proposal.current}
		{@const yes = p.ballots.filter((b) => b.vote === 'Yes').length}
		{@const no = p.ballots.filter((b) => b.vote === 'No').length}
		{@const n = p.members.length}
		{@const needed = Math.floor(n / 2) + 1}
		{@const ended = new Date(p.closesAt).getTime() < Date.now()}
		{@const member = me !== null && p.members.includes(me)}
		{@const myBallot = p.ballots.find((b) => b.voter === me) ?? null}
		{@const voted = myBallot !== null}
		{@const outcome = p.outcome ?? (ended ? (yes >= needed ? 'Passed' : 'Failed') : null)}
		{@const mine = me !== null && me === p.proposer}
		{@const canCancel = !p.outcome && (mine || (me !== null && me === p.admin))}

		<div class="mb-8">
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
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 class="display text-3xl md:text-4xl">{p.title}</h1>
					<p class="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-xs text-ink-dim">
						<span>Proposed by <span class="text-ink-mid">{nameOf(p.proposer)}</span></span>
						<PartyId party={p.proposer} />
						{#if p.createdAt}<span>· {relative(p.createdAt)}</span>{/if}
					</p>
				</div>
				{#if mine && !p.outcome && p.ballots.length === 0}
					<Button href="/proposals/{id}/edit" variant="outline" size="sm">Edit</Button>
				{/if}
			</div>
		</div>

		<Problem message={store.problem} />

		<div class="grid gap-8 lg:grid-cols-[1fr_320px]">
			<section class="space-y-8">
				<Panel class="text-sm leading-relaxed whitespace-pre-wrap">
					{p.description || 'No description.'}
				</Panel>

				<div>
					<SectionTitle title="Ballots" />
					{#if p.ballots.length === 0}
						<p class="text-[13px] text-ink-dim">No votes yet.</p>
					{:else}
						<List>
							{#each p.ballots as b (b.voter)}
								<ListItem class="flex items-center gap-3 font-mono text-xs">
									<span class={b.voter === me ? 'text-orange' : ''}>{nameOf(b.voter)}</span>
									<PartyId party={b.voter} class="min-w-0 flex-1" />
									<span class={b.vote === 'Yes' ? 'text-green' : 'text-red'}>{b.vote}</span>
								</ListItem>
							{/each}
						</List>
					{/if}
				</div>
			</section>

			<aside class="space-y-6">
				<Tally {yes} {no} total={n} {needed} />

				{#if outcome}
					<Note>
						{p.outcome ? 'Settled as' : 'Ended as'}
						<span class={outcome === 'Passed' ? 'text-green' : 'text-red'}>{outcome}</span>.
					</Note>
				{/if}
				{#if canCancel}
					<DangerZone
						compact
						text={mine ? 'Withdraw your proposal.' : 'As admin you can withdraw this proposal.'}
						action="Cancel proposal"
						confirm="Yes, withdraw"
						busy={store.busy}
						onconfirm={() => cancel(p.contractId, p.daoId)}
					/>
				{/if}
				{#if outcome}
					<!-- settled: nothing more to do -->
				{:else if store.screen.at === 'locked'}
					<Panel padding="sm" class="space-y-3">
						<p class="text-[13px] text-ink-dim">Unlock your wallet to vote.</p>
						<UnlockForm />
					</Panel>
				{:else if !store.who}
					<Note mono={false}>
						<a href="/wallet" class="text-orange hover:underline">Connect a wallet</a> to vote.
					</Note>
				{:else if !member}
					<Note mono={false}>Only members can vote.</Note>
				{:else if voted}
					<Note>
						You voted <span class={myBallot?.vote === 'Yes' ? 'text-green' : 'text-red'}
							>{myBallot?.vote}</span
						>.
					</Note>
				{:else}
					<Panel padding="sm" class="grid grid-cols-2 gap-3">
						<Button variant="accent" disabled={store.busy} onclick={() => vote(p.contractId, 'Yes')}
							>Yes</Button
						>
						<Button
							variant="destructive"
							disabled={store.busy}
							onclick={() => vote(p.contractId, 'No')}>No</Button
						>
					</Panel>
				{/if}
			</aside>
		</div>
	{/if}
</Page>
