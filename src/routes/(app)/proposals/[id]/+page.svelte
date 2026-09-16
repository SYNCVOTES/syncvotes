<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import Problem from '$lib/components/problem.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import UnlockForm from '$lib/components/unlock-form.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Note from '$lib/components/note.svelte';
	import Tally from '$lib/components/tally.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import DangerZone from '$lib/components/danger-zone.svelte';
	import SigningProgress from '$lib/components/signing-progress.svelte';
	import { relative } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const proposal = $derived(me ? remote.proposal(id) : null);

	let q = $state('');
	let limit = $state(20);
	const ballots = $derived(me ? remote.proposalBallots({ id, offset: 0, limit, q }) : null);
	let progress = $state({ done: 0, total: 0, what: '' });

	// The stream brings the new contract the moment the vote lands; nothing to refresh by hand.
	const vote = (right: string, choice: 'Yes' | 'No') =>
		flow.act((s, w) => actions.vote(s, w, right, choice));

	const open = (daoId: string) =>
		flow.act((s, w) =>
			actions.openVoting(
				s,
				w,
				id,
				daoId,
				(done, total) => (progress = { done, total, what: 'Opening the vote' })
			)
		);

	async function cancel(contractId: string, daoId: string) {
		const ok = await flow.act((s, w) => actions.cancelProposal(s, w, contractId));
		if (ok) await goto(`/daos/${daoId}`);
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
		<QueryError error={proposal.error} refresh={() => proposal?.reconnect()} />
	{:else if !proposal.ready}
		<Skeleton />
	{:else}
		{@const p = proposal.current}
		{@const needed = Math.floor(p.eligible / 2) + 1}
		{@const ended = new Date(p.closesAt).getTime() < Date.now()}
		{@const mine = me === p.proposer}
		{@const canCancel = !p.outcome && (mine || me === p.admin)}

		<div class="mb-8">
			<div class="mb-3 flex items-center gap-3">
				<StatusBadge outcome={p.outcome} closesAt={p.closesAt} ready={p.ready} />
				<span class="font-mono text-xs text-ink-dim">
					{p.outcome
						? 'closed'
						: !p.ready
							? 'voting not open yet'
							: ended
								? `ended ${relative(p.closesAt)}`
								: `closes ${relative(p.closesAt)}`}
				</span>
			</div>
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 class="display text-3xl md:text-4xl">{p.title}</h1>
					<p class="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-xs text-ink-dim">
						<span>Proposed by</span>
						<PartyId party={p.proposer} />
						<span>· {relative(p.createdAt)}</span>
					</p>
				</div>
				{#if mine && !p.ready}
					<Button href="/proposals/{id}/edit" variant="outline" size="sm">Edit</Button>
				{/if}
			</div>
		</div>

		<Problem message={store.problem} />
		<SigningProgress {...progress} />

		<div class="grid gap-8 lg:grid-cols-[1fr_320px]">
			<section class="space-y-8">
				<Panel class="text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap">
					{p.description || 'No description.'}
				</Panel>

				<div>
					<div class="mb-4 flex items-center justify-between gap-4">
						<h2 class="eyebrow">Ballots</h2>
						<div class="w-56"><SearchInput bind:value={q} placeholder="Filter by party id" /></div>
					</div>
					{#if ballots?.error}
						<QueryError error={ballots.error} refresh={() => ballots?.reconnect()} />
					{:else if !ballots?.ready}
						<Skeleton height="h-24" />
					{:else if ballots.current.total === 0}
						<p class="text-[13px] text-ink-dim">
							{q ? 'No ballot matches that.' : 'No votes yet.'}
						</p>
					{:else}
						<List>
							{#each ballots.current.items as b (b.voter)}
								<ListItem class="flex items-center gap-3 font-mono text-xs">
									<PartyId
										party={b.voter}
										class="min-w-0 flex-1 {b.voter === me
											? '[&>span>span:first-child]:text-orange'
											: ''}"
									/>
									<span class="text-ink-dim">{relative(b.castAt)}</span>
									{#if !b.counted}<span
											class="text-ink-dim"
											title="Cast; the provider has not counted it yet">pending</span
										>{/if}
									<span class={b.vote === 'Yes' ? 'text-green' : 'text-red'}>{b.vote}</span>
								</ListItem>
							{/each}
						</List>
						<LoadMore
							shown={ballots.current.items.length}
							total={ballots.current.total}
							noun="ballots"
							onmore={() => (limit += 20)}
						/>
					{/if}
				</div>
			</section>

			<aside class="space-y-6">
				<Tally yes={p.yes} no={p.no} total={p.eligible} {needed} cast={p.cast} />

				{#if !p.ready}
					<Note mono={false}>
						{#if mine}
							Voting has not opened: rights still have to be issued to the members.
							<div class="mt-3">
								<Button size="sm" disabled={store.busy} onclick={() => open(p.daoId)}
									>Open the vote</Button
								>
							</div>
						{:else}
							The proposer has not opened the vote yet.
						{/if}
					</Note>
				{:else if p.outcome}
					<Note>
						Settled as <span class={p.outcome === 'Passed' ? 'text-green' : 'text-red'}
							>{p.outcome}</span
						>.
					</Note>
				{:else if ended}
					<Note>The deadline has passed; the last ballots are being counted.</Note>
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

				{#if p.ready && !p.outcome && !ended}
					{#if store.screen.at === 'locked'}
						<Panel padding="sm" class="space-y-3">
							<p class="text-[13px] text-ink-dim">Unlock your wallet to vote.</p>
							<UnlockForm />
						</Panel>
					{:else if p.me.vote}
						<Note
							>You voted <span class={p.me.vote === 'Yes' ? 'text-green' : 'text-red'}
								>{p.me.vote}</span
							>.</Note
						>
					{:else if p.me.right}
						{@const right = p.me.right}
						<Panel padding="sm" class="grid grid-cols-2 gap-3">
							<Button variant="accent" disabled={store.busy} onclick={() => vote(right, 'Yes')}
								>Yes</Button
							>
							<Button variant="destructive" disabled={store.busy} onclick={() => vote(right, 'No')}
								>No</Button
							>
						</Panel>
					{:else}
						<Note mono={false}>You joined after this vote opened, so it has no ballot for you.</Note
						>
					{/if}
				{/if}
			</aside>
		</div>
	{/if}
</Page>
