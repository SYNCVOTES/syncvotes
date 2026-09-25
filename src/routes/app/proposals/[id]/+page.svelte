<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Page from '$lib/components/page.svelte';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Who from '$lib/components/who.svelte';
	import Avatar from '$lib/components/avatar.svelte';
	import Note from '$lib/components/note.svelte';
	import Hint from '$lib/components/hint.svelte';
	import Tally from '$lib/components/tally.svelte';
	import ChoiceTally from '$lib/components/choice-tally.svelte';
	import EffectCard from '$lib/components/effect-card.svelte';
	import EffectLabel from '$lib/components/effect-label.svelte';
	import EntityHeader from '$lib/components/entity-header.svelte';
	import VoteBox from '$lib/components/vote-box.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import Comments from '$lib/components/comments.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import { relative, dateOf } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const proposal = $derived(me ? remote.proposal(id) : null);

	let q = $state('');
	let limit = $state(20);
	// Who voted how is the members' business: a reader of a public DAO gets the totals only.
	const ballots = $derived(
		me && proposal?.current?.me.membership
			? remote.proposalBallots({ id, offset: 0, limit, q })
			: null
	);
	const holders = $derived(
		proposal?.current && proposal.current.effect.kind === 'shares' && !proposal.current.executedAt
			? remote.daoShares(proposal.current.daoId)
			: null
	);

	const tone = (v: string) =>
		v === 'Yes'
			? 'text-green'
			: v === 'No'
				? 'text-red'
				: v === 'Abstain'
					? 'text-ink-dim'
					: 'text-ink';
	/** The options a vote picked or a choice decided on, by index; none for yes, no, abstain. */
	const picksOf = (v: string): number[] => {
		const m = /^(?:Pick|Chosen|PickMany|ChosenMany):(.*)$/.exec(v);
		return m ? m[1].split(',').filter(Boolean).map(Number) : [];
	};
	/** A vote as words: yes, no, abstain, or the options picked. */
	const said = (v: string, options: string[] = []) => {
		const picks = picksOf(v);
		return picks.length ? picks.map((i) => options[i] ?? `option ${i + 1}`).join(', ') : v;
	};
	const pct = (units: number, of: number) => (of > 0 ? Math.round((units / of) * 1000) / 10 : 0);
	// Time moves without a ledger event: the deadline and the signing margin are re-read each minute.
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(t);
	});
</script>

<svelte:head><title>{proposal?.current?.title ?? 'Proposal'} — SyncVotes</title></svelte:head>

<Page
	back={proposal?.current
		? { href: `/app/daos/${proposal.current.daoId}`, label: proposal.current.daoName ?? 'DAO' }
		: { href: '/app/my-daos', label: 'My DAOs' }}
>
	{#if store.screen.at === 'loading'}
		<Skeleton />
	{:else if !proposal}
		<ConnectPrompt what="see this proposal" />
	{:else if proposal.error}
		<QueryError error={proposal.error} refresh={() => proposal?.reconnect()} />
	{:else if !proposal.ready}
		<Skeleton />
	{:else}
		{@const p = proposal.current}
		{@const ended = new Date(p.closesAt).getTime() < now}
		{@const options = p.effect.kind === 'choose' ? p.effect.options : []}
		{@const acts = p.effect.kind !== 'signal' && p.effect.kind !== 'choose'}

		<EntityHeader title={p.title}>
			{#snippet above()}
				<div class="mb-3 flex items-center gap-3">
					<StatusBadge outcome={p.outcome} closesAt={p.closesAt} executedAt={p.executedAt} />
					{#if !p.outcome}
						<span class="font-mono text-xs text-ink-dim"
							>{ended ? `closed ${relative(p.closesAt)}` : `closes ${relative(p.closesAt)}`}</span
						>
					{/if}
				</div>
			{/snippet}
			{#snippet meta()}
				<span>Proposed by</span>
				<span class="inline-flex items-center gap-1.5">
					<Avatar who={p.proposedBy} size="xs" />
					{#if p.proposedBy.name}<span class="text-ink">{p.proposedBy.name}</span>{/if}
					<PartyId party={p.proposer} />
				</span>
				<span>· {dateOf(p.createdAt)}</span>
				<span>·</span>
				<EffectLabel effect={p.effect} equal={p.daoEqual} />
			{/snippet}
			<!-- The outcome, said once and first: what was decided, or where it stands. -->
			{#if p.outcome}
				<div class="mt-5">
					{#if acts && p.stuck}
						<Note tone="danger">Not executed yet: {p.stuck}. Retrying.</Note>
					{:else if acts && p.outcome === 'Passed' && !p.executedAt && p.waiting}
						<Note tone="warn">Passed. Waiting for {p.waiting}.</Note>
					{:else if acts && p.outcome === 'Passed' && !p.executedAt}
						<Note tone="warn">Passed. Executing…</Note>
					{:else}
						<Note tone={p.outcome === 'Failed' ? 'danger' : 'success'}>
							<span class="text-body text-ink"
								>Result: <strong class={p.outcome === 'Failed' ? 'text-red' : 'text-green'}
									>{p.outcome.startsWith('Chosen') ? said(p.outcome, options) : p.outcome}</strong
								>.</span
							>{#if acts && p.executedAt}&nbsp;Executed {dateOf(p.executedAt)}.{/if}
						</Note>
					{/if}
				</div>
			{:else if ended}
				<div class="mt-5"><Note tone="warn">Voting closed. Counting the last ballots.</Note></div>
			{/if}
		</EntityHeader>

		<div class="grid gap-8 lg:grid-cols-[1fr_320px]">
			<section class="min-w-0 space-y-8">
				{#if p.description.trim()}
					<div class="max-w-[680px]"><Markdown text={p.description} /></div>
				{/if}

				{#if p.effect.kind !== 'signal' && p.effect.kind !== 'choose'}
					<EffectCard
						effect={p.effect}
						executed={p.executed}
						executedAt={p.executedAt}
						equal={p.daoEqual}
						current={holders?.current ?? []}
					/>
				{/if}

				{#if p.me.membership}
					<div>
						<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
							<h2 class="eyebrow">Ballots</h2>
							{#if !p.secret}
								<div class="w-full sm:w-64">
									<SearchInput bind:value={q} placeholder="Search by name or party ID" />
								</div>
							{/if}
						</div>
						{#if ballots?.error}
							<QueryError error={ballots.error} refresh={() => ballots?.reconnect()} />
						{:else if !ballots?.ready}
							<Skeleton height="h-24" />
						{:else if p.secret}
							<p class="mb-3 flex items-center gap-1.5 text-body-sm text-ink-dim">
								Secret ballot. You see only your own vote.
								<Hint
									text="Members see totals and their own vote only. The app still sees each ballot, because it counts them."
								/>
							</p>
							{#if ballots.current.total > 0}
								<List>
									{#each ballots.current.items as b (b.voter)}
										<ListItem class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
											<Who who={b.who} me={b.voter === me} class="min-w-0 flex-1 basis-56" />
											<span class="max-w-40 truncate text-right {tone(b.vote)}"
												>{said(b.vote, options)}</span
											>
										</ListItem>
									{/each}
								</List>
							{/if}
						{:else if ballots.current.total === 0}
							<p class="text-body-sm text-ink-dim">
								{q ? 'No matches.' : 'No votes yet.'}
							</p>
						{:else}
							<List>
								{#each ballots.current.items as b (b.voter)}
									<ListItem class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
										<Who who={b.who} me={b.voter === me} class="min-w-0 flex-1 basis-56" />
										<span class="flex shrink-0 items-center gap-3">
											<span class="text-ink-mid">{pct(b.weight, p.eligible)}%</span>
											<span class="text-ink-dim">{relative(b.castAt)}</span>
											{#if !b.counted}<span class="text-ink-dim" title="Not yet counted by the app"
													>{p.rule.changeable ? 'may change' : 'not counted yet'}</span
												>{/if}
											<span class="max-w-40 truncate text-right {tone(b.vote)}"
												>{said(b.vote, options)}</span
											>
										</span>
									</ListItem>
								{/each}
							</List>
							<LoadMore
								shown={ballots.current.items.length}
								total={ballots.current.total}
								noun="ballots"
								onmore={(n) => (limit = n)}
							/>
						{/if}
					</div>
				{:else}
					<Note>Only members see ballots.</Note>
				{/if}

				<Comments
					proposal={id}
					member={!!p.me.membership}
					actorPays={p.daoActorPays}
					closed={!!p.outcome || ended}
				/>
			</section>

			<aside class="order-first min-w-0 space-y-6 lg:sticky lg:top-24 lg:order-none lg:self-start">
				<VoteBox {p} {id} {now} />
				{#if p.sealed}
					<div>
						<h2 class="eyebrow mb-2">Tally</h2>
						<p class="text-body-sm text-ink-mid">
							Secret ballot. The totals are shown once the vote is decided.
						</p>
					</div>
				{:else if p.effect.kind === 'choose'}
					<ChoiceTally
						options={p.effect.options}
						tallies={p.tallies}
						abstain={p.abstain}
						eligible={p.eligible}
						cast={p.cast}
						rule={p.rule}
						counted={p.counted > 0 || !!p.outcome}
						several={p.effect.several}
						picked={p.picked}
						chosen={p.outcome ? picksOf(p.outcome) : []}
					/>
				{:else}
					<Tally
						yes={p.yes}
						no={p.no}
						abstain={p.abstain}
						eligible={p.eligible}
						cast={p.cast}
						rule={p.rule}
						counted={p.counted > 0 || !!p.outcome}
					/>
				{/if}
			</aside>
		</div>
	{/if}
</Page>
