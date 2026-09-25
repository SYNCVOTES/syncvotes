<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	// Where traffic is free, no DAO is ever out of balance.
	const setup = remote.config();
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Monogram from '$lib/components/monogram.svelte';
	import Who from '$lib/components/who.svelte';
	import SectionTitle from '$lib/components/section-title.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import StateMessage from '$lib/components/state-message.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import RoleTag from '$lib/components/role-tag.svelte';
	import EffectLabel from '$lib/components/effect-label.svelte';
	import ShareBar from '$lib/components/share-bar.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import Note from '$lib/components/note.svelte';
	import { categoryOf } from '$lib/rules';
	import Hint from '$lib/components/hint.svelte';
	import SettingsSummary from '$lib/components/settings-summary.svelte';
	import Problem from '$lib/components/problem.svelte';
	import BalancePanel from '$lib/components/balance-panel.svelte';
	import CopyField from '$lib/components/copy-field.svelte';
	import EntityHeader from '$lib/components/entity-header.svelte';
	import Tag from '$lib/components/tag.svelte';
	import FilterTabs from '$lib/components/filter-tabs.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Lock from '@lucide/svelte/icons/lock';
	import Globe from '@lucide/svelte/icons/globe';
	import { relative, dateOf, fmt, coin, hintOf } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);

	// The proposal list is paged and filtered on the server; more pages append below.
	let status = $state<'open' | 'closed' | 'unvoted' | undefined>(undefined);
	/** Every vote cast: for and against, abstaining, and the ballots that picked options. */
	const castOf = (p: {
		yes: number;
		no: number;
		abstain: number;
		tallies: number[];
		picked: number | null;
	}) => p.yes + p.no + p.abstain + (p.picked ?? p.tallies.reduce((s, t) => s + t, 0));
	let limit = $state(20);
	let q = $state('');
	const proposals = $derived(me ? remote.daoProposals({ id, offset: 0, limit, status, q }) : null);
	// What waits on the viewer's vote: the strip over the list, and a Vote chip on its rows.
	const unvoted = $derived(
		me && dao?.current?.me.membership
			? remote.daoProposals({ id, offset: 0, limit: 100, status: 'unvoted', q: '' })
			: null
	);
	const waiting = $derived(new Set(unvoted?.current?.items.map((p) => p.id) ?? []));
	const preview = $derived(me ? remote.daoMembers({ id, offset: 0, limit: 8, q: '' }) : null);
	// One balance, from one source: the figure in the header is the one the Balance section shows.
	const billing = $derived(
		me && dao?.current && !dao.current.actorPays ? remote.daoBilling(id) : null
	);

	const pct = (units: number, of: number) => (of > 0 ? Math.round((units / of) * 1000) / 10 : 0);
	// A long description is clamped to three lines until asked for.
	let expanded = $state(false);
</script>

<svelte:head><title>{dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page
	width="wide"
	back={dao?.current && !dao.current.me.membership
		? { href: '/daos', label: 'Public DAOs' }
		: { href: '/my-daos', label: 'My DAOs' }}
>
	{#if store.screen.at === 'loading'}
		<Skeleton />
	{:else if !dao}
		<ConnectPrompt what="see this DAO" />
	{:else if dao.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else if !dao.ready}
		<Skeleton />
	{:else}
		{@const d = dao.current}
		{@const empty =
			!d.actorPays && d.balance <= 0 && (billing?.current?.free ?? setup.current?.free) === false}

		{#if d.image}
			<div class="-mt-2 mb-6 h-40 w-full overflow-hidden border border-border md:h-52">
				<img referrerpolicy="no-referrer" src={d.image} alt="" class="size-full object-cover" />
			</div>
		{/if}

		<EntityHeader title={d.name}>
			{#snippet media()}
				{#if !d.image}<Monogram name={d.name} size="lg" />{/if}
			{/snippet}
			{#snippet tags()}
				{#if d.public}
					<Tag icon={Globe} class="overflow-visible pr-1.5"
						>Public <Hint
							text="Anyone signed in can read this DAO. Only members act, and ballots stay visible to members only."
						/></Tag
					>
				{:else}
					<Tag icon={Lock} class="overflow-visible pr-1.5"
						>Private <Hint text="Only members can see this DAO." /></Tag
					>
				{/if}
				<Tag>{d.equal ? 'By membership' : 'By shares'}</Tag>
				{#if d.me.creator}<Tag>Creator</Tag>{:else if !d.me.membership}<Tag>Reader</Tag>{/if}
			{/snippet}
			{#snippet meta()}
				<span>{fmt(d.members)} {d.members === 1 ? 'member' : 'members'}</span>
				<span aria-hidden="true">·</span>
				<span class={d.openProposals > 0 ? 'text-ink' : ''}>{fmt(d.openProposals)} open</span>
				{#if d.actorPays}
					<span aria-hidden="true">·</span><span>members pay</span>
				{:else if billing?.ready && !billing.current.free}
					<span aria-hidden="true">·</span>
					<a
						href="#balance"
						class="hover:text-orange {billing.current.balance <= 0 ? 'text-red' : ''}"
						>{coin(billing.current.balance)}</a
					>
				{/if}
				{#if d.me.membership}
					<span aria-hidden="true">·</span>
					<span
						>your voting power {d.equal
							? `1 of ${fmt(d.units)}`
							: `${pct(d.me.share, d.units)}%`}</span
					>
				{/if}
				<span aria-hidden="true">·</span>
				<span class="inline-flex items-center gap-1.5"
					>Created {dateOf(d.createdAt)} by <PartyId party={d.creator} /></span
				>
			{/snippet}
			{#snippet action()}
				{#if d.me.membership && !empty && !d.dissolving}
					<Button href="/daos/{d.id}/proposals/create"
						><Plus strokeWidth={2.5} /> New proposal</Button
					>
				{/if}
			{/snippet}
			<div class="mt-4 max-w-[720px] space-y-3">
				{#if !d.me.membership}
					<p class="font-mono text-xs text-ink-dim">
						You're viewing a public DAO. See its description for how to join.
					</p>
				{:else if d.dissolving}
					<p class="font-mono text-xs text-red">
						A dissolution passed. It takes effect once the open proposals are decided; nothing new
						can be proposed.
					</p>
				{:else if empty}
					<p class="flex flex-wrap items-center gap-3 font-mono text-xs text-red">
						The DAO's balance is empty. Top it up to act.
						<Button href="#balance" variant="outline" size="sm">Top up</Button>
					</p>
				{/if}
				{#if d.description.trim()}
					<div class={expanded ? '' : 'line-clamp-3'}>
						<Markdown text={d.description} />
					</div>
					{#if d.description.length > 240 || d.description.split('\n').length > 3}
						<button
							type="button"
							class="font-mono text-xs text-ink-dim underline hover:text-ink"
							onclick={() => (expanded = !expanded)}>{expanded ? 'Less' : 'More'}</button
						>
					{/if}
				{:else}
					<p class="text-sm text-ink-dim">No description.</p>
				{/if}
			</div>
		</EntityHeader>

		<Problem message={store.problem} />
		{#if d.founding}
			<Note class="mb-6">Adding founding members…</Note>
		{/if}

		<div class="grid gap-10 lg:grid-cols-[1fr_320px]">
			<section class="min-w-0">
				{#if waiting.size > 0 && status !== 'unvoted'}
					<div
						class="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-2 border-orange bg-orange/[0.04] py-3 pr-3 pl-4"
					>
						<p class="text-body-sm text-ink">
							{fmt(waiting.size)}
							{waiting.size === 1 ? 'open proposal' : 'open proposals'} not voted
						</p>
						<Button
							size="sm"
							variant="accent"
							onclick={() => {
								status = 'unvoted';
								limit = 20;
							}}>Vote <ArrowRight size={14} /></Button
						>
					</div>
				{/if}
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
					<h2 class="eyebrow">Proposals</h2>
					<div class="flex flex-wrap items-center gap-3">
						<FilterTabs
							label="Show proposals"
							bind:value={status}
							onchange={() => (limit = 20)}
							options={[
								{ value: undefined, label: 'All' },
								{ value: 'open', label: 'Open' },
								{ value: 'closed', label: 'Closed' },
								...(d.me.membership
									? [{ value: 'unvoted' as const, label: 'Not voted', count: waiting.size }]
									: [])
							]}
						/>
						<div class="w-full sm:w-56">
							<SearchInput bind:value={q} placeholder="Search by title or proposer" />
						</div>
					</div>
				</div>
				{#if proposals?.error}
					<QueryError error={proposals.error} refresh={() => proposals?.reconnect()} />
				{:else if !proposals?.ready}
					<Skeleton height="h-24" />
				{:else if proposals.current.total === 0}
					<StateMessage variant="dashed"
						>{status === 'unvoted'
							? 'Nothing to vote on.'
							: status
								? `No ${status} proposals.`
								: 'No proposals yet.'}</StateMessage
					>
				{:else}
					<List>
						{#each proposals.current.items as p (p.id)}
							{@const due = waiting.has(p.id)}
							<ListItem href="/proposals/{p.id}" padding="md" class="min-w-0">
								<div class="min-w-0 flex-1">
									<div class="flex min-w-0 items-center gap-2">
										<span class="truncate font-display text-body font-bold">{p.title}</span>
										{#if categoryOf(p.effect.kind) === 'sensitive'}
											<Tag class="hidden sm:inline-flex">changes the DAO</Tag>
										{/if}
									</div>
									<div
										class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-ink-dim"
									>
										<EffectLabel effect={p.effect} equal={d.equal} />
										{#if !p.outcome}<span>· closes {relative(p.closesAt)}</span>{/if}
										<span
											>· {p.sealed
												? 'secret ballot'
												: castOf(p) === 0
													? 'no votes yet'
													: `${pct(castOf(p), p.eligible)}% voted`}</span
										>
										<span>· by {hintOf(p.proposer)}</span>
									</div>
								</div>
								{#if due}
									<span
										class="rounded-full bg-orange-dim px-3 py-1 font-mono text-label tracking-[0.14em] text-orange uppercase"
										>Vote</span
									>
								{:else}
									<StatusBadge
										outcome={p.outcome}
										closesAt={p.closesAt}
										executedAt={p.executedAt}
									/>
								{/if}
								<ArrowRight
									size={16}
									class="shrink-0 text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
									aria-hidden="true"
								/>
							</ListItem>
						{/each}
					</List>
					<LoadMore
						shown={proposals.current.items.length}
						total={proposals.current.total}
						noun="proposals"
						onmore={(n) => (limit = n)}
					/>
				{/if}
			</section>

			<aside class="min-w-0 space-y-8">
				<div>
					<SectionTitle title={d.equal ? 'Members' : 'Shares of the vote'} count={fmt(d.members)} />
					{#if preview?.ready}
						{#if !d.equal}
							<div class="mb-3">
								<ShareBar members={preview.current.items} units={d.units} {me} />
							</div>
						{/if}
						<List>
							{#each preview.current.items.slice(0, 6) as m (m.party)}
								<ListItem class="flex items-center justify-between gap-3 font-mono text-xs">
									<Who who={m.who} me={m.party === me} class="min-w-0 flex-1" />
									<span class="flex shrink-0 items-center gap-3">
										{#if m.party === d.creator}<RoleTag role="creator" />{/if}
										{#if !d.equal}<span class="w-14 text-right text-ink"
												>{pct(m.share, d.units)}%</span
											>{/if}
									</span>
								</ListItem>
							{/each}
						</List>
					{:else}
						<div class="space-y-1">
							{#each [1, 2, 3] as i (i)}<Skeleton height="h-11" />{/each}
						</div>
					{/if}
					<Button href="/daos/{d.id}/members" variant="outline" size="sm" class="mt-3 w-full">
						All members
						<ArrowRight size={14} />
					</Button>
				</div>

				<div>
					<h2 class="eyebrow">Voting rules</h2>
					<SettingsSummary sensitive={d.sensitive} eligible={d.units} equal={d.equal} compact />
				</div>

				{#if d.actorPays}
					<section class="space-y-2">
						<h2 class="eyebrow flex items-center gap-1.5">
							Who pays <Hint
								text="Proposers also pay for counting and executing their proposals."
							/>
						</h2>
						<p class="text-body-sm text-ink-mid">
							Each member pays for what they sign, from their own balance on their Wallet page.
						</p>
					</section>
				{:else}
					<BalancePanel dao={d.id} />
				{/if}

				{#if d.public}
					<CopyField
						label="DAO ID"
						value={d.id}
						hint="Anyone can create a DAO under any name. Check this ID against the organization's own site."
					/>
				{/if}
			</aside>
		</div>
	{/if}
</Page>
