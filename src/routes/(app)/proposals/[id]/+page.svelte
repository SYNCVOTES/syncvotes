<script lang="ts">
	import { page } from '$app/state';
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
	import Who from '$lib/components/who.svelte';
	import Avatar from '$lib/components/avatar.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Note from '$lib/components/note.svelte';
	import Tally from '$lib/components/tally.svelte';
	import ChoiceTally from '$lib/components/choice-tally.svelte';
	import EffectCard from '$lib/components/effect-card.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import Comments from '$lib/components/comments.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import Loader from '@lucide/svelte/icons/loader';
	import { relative, dateOf, fmt } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const proposal = $derived(me ? remote.proposal(id) : null);

	let q = $state('');
	let limit = $state(20);
	const ballots = $derived(me ? remote.proposalBallots({ id, offset: 0, limit, q }) : null);
	const holders = $derived(
		proposal?.current && proposal.current.effect.kind === 'shares' && !proposal.current.executedAt
			? remote.daoShares(proposal.current.daoId)
			: null
	);

	// Every write lands on this page through the live query; nothing to refresh by hand. The
	// button pressed says so until the ledger answers; the activity pill says what is happening.
	let casting = $state<actions.Choice | null>(null);
	let changing = $state(false);
	async function vote(choice: actions.Choice) {
		const p = proposal?.current;
		if (!p?.me.membership) return;
		const membership = p.me.membership;
		casting = choice;
		try {
			await flow.act((s, w) =>
				actions.vote(s, w, id, choice, membership, p.closesAt, p.rule.changeable, p.me.ballot)
			);
			changing = false;
		} finally {
			casting = null;
		}
	}
	const tone = (v: string) =>
		v === 'Yes'
			? 'text-green'
			: v === 'No'
				? 'text-red'
				: v === 'Abstain'
					? 'text-ink-dim'
					: 'text-ink';
	/** A vote as words: yes, no, abstain, or the option picked. */
	const said = (v: string, options: string[] = []) =>
		v.startsWith('Pick:') ? (options[Number(v.slice(5))] ?? `option ${Number(v.slice(5)) + 1}`) : v;
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
		? { href: `/daos/${proposal.current.daoId}`, label: proposal.current.daoName ?? 'DAO' }
		: undefined}
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
		{@const tooLate = new Date(p.closesAt).getTime() - now < 90_000}
		{@const canVote = !p.outcome && !ended && !tooLate && p.me.mayVote}
		{@const showBox = canVote && (!p.me.vote || changing)}

		<div class="mb-8">
			<div class="mb-3 flex items-center gap-3">
				<StatusBadge outcome={p.outcome} closesAt={p.closesAt} executedAt={p.executedAt} />
				<span class="font-mono text-xs text-ink-dim">
					{p.outcome
						? 'closed'
						: ended
							? `ended ${relative(p.closesAt)}`
							: `closes ${relative(p.closesAt)}`}
				</span>
			</div>
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="min-w-0">
					<h1 class="display text-3xl md:text-4xl">{p.title}</h1>
					<p class="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-xs text-ink-dim">
						<span>Proposed by</span>
						<span class="inline-flex items-center gap-1.5">
							<Avatar who={p.proposedBy} size="xs" />
							{#if p.proposedBy.name}<span class="text-ink">{p.proposedBy.name}</span>{/if}
							<PartyId party={p.proposer} />
						</span>
						<span>· {dateOf(p.createdAt)} ({relative(p.createdAt)})</span>
					</p>
				</div>
			</div>
		</div>

		<div class="grid gap-8 lg:grid-cols-[1fr_320px]">
			<section class="min-w-0 space-y-8">
				<Panel>
					<Markdown text={p.description} fallback="No description." />
				</Panel>

				{#if p.effect.kind !== 'signal' && p.effect.kind !== 'choose'}
					<EffectCard
						effect={p.effect}
						executed={p.executed}
						executedAt={p.executedAt}
						equal={p.daoEqual}
						current={holders?.current ?? []}
					/>
					{#if p.stuck}
						<Note mono={false}>
							<span class="text-red">Could not be carried out yet:</span>
							{p.stuck}. The provider keeps trying.
						</Note>
					{:else if p.waiting && !p.executedAt}
						<Note mono={false}>Passed; waiting for {p.waiting}.</Note>
					{:else if p.outcome === 'Passed' && !p.executedAt}
						<Note mono={false}>Passed; being carried out.</Note>
					{/if}
				{/if}

				<div>
					<div class="mb-4 flex items-center justify-between gap-4">
						<h2 class="eyebrow">Ballots</h2>
						<div class="w-56">
							<SearchInput bind:value={q} placeholder="Filter by name or id" />
						</div>
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
								<ListItem class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
									<Who who={b.who} me={b.voter === me} class="min-w-0 flex-1 basis-56" />
									<span class="flex shrink-0 items-center gap-3">
										<span class="text-ink-mid">{pct(b.weight, p.eligible)}%</span>
										<span class="text-ink-dim">{relative(b.castAt)}</span>
										{#if !b.counted}<span
												class="text-ink-dim"
												title={p.rule.changeable
													? 'Counted at the deadline'
													: 'Cast; the provider has not counted it yet'}
												>{p.rule.changeable ? 'may change' : 'not counted yet'}</span
											>{/if}
										<span class="max-w-40 truncate text-right {tone(b.vote)}"
											>{said(b.vote, p.effect.kind === 'choose' ? p.effect.options : [])}</span
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

				<Comments proposal={id} member={!!p.me.membership} />
			</section>

			<aside class="order-first min-w-0 space-y-6 lg:order-none">
				{#if p.effect.kind === 'choose'}
					<ChoiceTally
						options={p.effect.options}
						tallies={p.tallies}
						abstain={p.abstain}
						eligible={p.eligible}
						cast={p.cast}
						rule={p.rule}
						counted={p.counted > 0 || !!p.outcome}
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

				{#if p.outcome}
					<Note>
						{#if p.outcome.startsWith('Chosen:')}
							Decided: <span class="text-green"
								>{said(
									p.outcome.replace('Chosen:', 'Pick:'),
									p.effect.kind === 'choose' ? p.effect.options : []
								)}</span
							>.
						{:else}
							Settled as <span class={p.outcome === 'Passed' ? 'text-green' : 'text-red'}
								>{p.outcome}</span
							>.
						{/if}
					</Note>
				{:else if ended}
					<Note>The deadline has passed; the last ballots are being counted.</Note>
				{/if}

				{#if !p.outcome && !ended}
					{#if store.screen.at === 'locked'}
						<Panel padding="sm" class="space-y-3">
							<p class="text-[13px] text-ink-dim">Unlock your wallet to vote.</p>
							<UnlockForm />
						</Panel>
					{:else if showBox}
						<Panel padding="sm" class="space-y-3">
							<Problem message={store.problem} />
							<p class="text-[13px] text-ink-dim">
								{#if changing}You voted {said(
										p.me.vote ?? '',
										p.effect.kind === 'choose' ? p.effect.options : []
									)}; cast again to change it.{:else}Your vote weighs {pct(
										p.me.weight ?? 0,
										p.eligible
									)}%.{/if}
							</p>
							{#if p.effect.kind === 'choose'}
								<div class="grid gap-2">
									{#each p.effect.options as o, i (i)}
										<Button
											variant="outline"
											class="justify-start"
											disabled={store.busy}
											onclick={() => vote(`Pick:${i}`)}
										>
											{#if casting === `Pick:${i}`}<Loader size={14} class="animate-spin" />{/if}{o}
										</Button>
									{/each}
								</div>
							{:else}
								<div class="grid grid-cols-2 gap-3">
									<Button variant="accent" disabled={store.busy} onclick={() => vote('Yes')}>
										{#if casting === 'Yes'}<Loader size={14} class="animate-spin" />{/if}Yes
									</Button>
									<Button variant="destructive" disabled={store.busy} onclick={() => vote('No')}>
										{#if casting === 'No'}<Loader size={14} class="animate-spin" />{/if}No
									</Button>
								</div>
							{/if}
							<Button
								variant="ghost"
								size="sm"
								class="w-full"
								disabled={store.busy}
								onclick={() => vote('Abstain')}
							>
								{#if casting === 'Abstain'}<Loader size={14} class="animate-spin" />{/if}Abstain
							</Button>
							{#if changing}
								<Button variant="ghost" size="sm" class="w-full" onclick={() => (changing = false)}
									>Keep it</Button
								>
							{/if}
						</Panel>
					{:else if p.me.vote}
						<Note
							>You voted <span class={tone(p.me.vote)}
								>{p.me.vote === 'Abstain'
									? 'to abstain'
									: said(p.me.vote, p.effect.kind === 'choose' ? p.effect.options : [])}</span
							>{p.me.weight !== null ? ` with ${pct(p.me.weight, p.eligible)}%` : ''}.
							{#if canVote}
								<button
									type="button"
									class="ml-1 underline hover:text-ink"
									onclick={() => (changing = true)}>Change it</button
								>
							{:else if p.rule.changeable}
								<span class="block text-ink-dim">Counted; it can no longer change.</span>
							{/if}</Note
						>
					{:else if p.me.membership && tooLate}
						<Note mono={false}>Too close to the deadline to sign a ballot in time.</Note>
					{:else if p.me.membership}
						<Note mono={false}
							>{p.me.reshared
								? 'Your share changed after this vote opened, so it has no ballot for you.'
								: 'You joined after this vote opened, so it has no ballot for you.'}</Note
						>
					{/if}
				{/if}

				<p class="font-mono text-xs text-ink-dim">
					{fmt(p.members)}
					{p.members === 1 ? 'member' : 'members'} · {fmt(p.eligible)} units of the vote
					{#if p.comments}· {fmt(p.comments)} {p.comments === 1 ? 'comment' : 'comments'}{/if}
				</p>
			</aside>
		</div>
	{/if}
</Page>
