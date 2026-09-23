<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import Page from '$lib/components/page.svelte';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Monogram from '$lib/components/monogram.svelte';
	import Who from '$lib/components/who.svelte';
	import Facts from '$lib/components/facts.svelte';
	import SectionTitle from '$lib/components/section-title.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
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
	import Panel from '$lib/components/panel.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { relative, dateOf, fmt, coin } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);

	// The proposal list is paged and filtered on the server; more pages append below.
	let status = $state<'open' | 'closed' | undefined>(undefined);
	let limit = $state(20);
	let q = $state('');
	const proposals = $derived(me ? remote.daoProposals({ id, offset: 0, limit, status, q }) : null);
	const preview = $derived(me ? remote.daoMembers({ id, offset: 0, limit: 8, q: '' }) : null);

	const pct = (units: number, of: number) => (of > 0 ? Math.round((units / of) * 1000) / 10 : 0);
	// The facts of a proposal as small tags, so a list scans instead of reads.
	const tag =
		'inline-flex items-center rounded-full border border-border bg-surface-hover px-2 py-0.5 font-mono text-[0.6875rem] text-ink-mid';
</script>

<svelte:head><title>{dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page width="wide" back={{ href: '/my-daos', label: 'My DAOs' }}>
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

		{#if d.image}
			<div class="-mt-2 mb-8 h-44 w-full overflow-hidden border border-border md:h-56">
				<img src={d.image} alt="" class="size-full object-cover" />
			</div>
		{/if}

		<div class="flex flex-wrap items-start justify-between gap-6">
			<div class="flex items-start gap-5">
				{#if !d.image}<Monogram name={d.name} size="lg" />{/if}
				<div class="min-w-0">
					<h1 class="display text-3xl md:text-4xl">{d.name}</h1>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						{#if d.public}
							<Badge variant="green" class="overflow-visible pr-1.5">
								Public
								<Hint
									text="Anyone signed in to the app can read this DAO — its proposals, outcomes, members and comments — and pay in to its balance. Only members act, and who voted how stays with the members. Nothing about it is public on the Canton network itself."
								/>
							</Badge>
						{:else}
							<Badge variant="accent" class="overflow-visible pr-1.5">
								Private
								<Hint
									text="Only its members and the app see this DAO, its proposals, votes and comments; nothing about it is public on the network."
								/>
							</Badge>
						{/if}
						<Badge>{d.equal ? 'By membership' : 'By shares'}</Badge>
						{#if d.me.creator}<Badge variant="amber">You created it</Badge
							>{:else if d.me.membership}<Badge variant="green">Member</Badge>{:else}<Badge
								>Reading</Badge
							>{/if}
					</div>
					{#if !d.me.membership}
						<p class="mt-3 font-mono text-xs text-ink-dim">
							You are not a member: this DAO is public, so you can read it. How to join, if at all,
							is for its description to say.
						</p>
					{:else if d.balance <= 0 && !d.actorPays}
						<p class="mt-3 font-mono text-xs text-red">
							Nothing can be signed for this DAO until someone pays in.
						</p>
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if !d.me.membership || (d.balance <= 0 && !d.actorPays)}
					<!-- Nothing to press: the line under the badges says why. -->
				{:else}
					<Button href="/daos/{d.id}/proposals/create"
						><Plus strokeWidth={2.5} /> New proposal</Button
					>
				{/if}
			</div>
		</div>

		<div class="mt-6 max-w-[720px]">
			<Markdown text={d.description} fallback="No description provided." />
			<p class="mt-3 font-mono text-xs text-ink-dim">
				Established {dateOf(d.createdAt)} · created by <PartyId
					party={d.creator}
					class="align-middle"
				/>
			</p>
		</div>

		<div class="mt-8"><Problem message={store.problem} /></div>
		{#if d.founding}
			<div class="mt-4">
				<Note mono={false}
					>The founding table is still being carried out; members are joining in batches.</Note
				>
			</div>
		{/if}

		<Facts
			items={[
				{ label: 'Members', value: fmt(d.members) },
				{ label: 'Open proposals', value: fmt(d.openProposals), accent: d.openProposals > 0 },
				d.actorPays
					? { label: 'Who pays', value: 'members', accent: false }
					: { label: 'Balance', value: coin(d.balance), accent: d.balance <= 0 },
				d.me.membership
					? {
							label: 'Your vote',
							value: d.equal ? '1 of ' + fmt(d.units) : `${pct(d.me.share, d.units)}%`
						}
					: { label: 'Visibility', value: 'public' }
			]}
		/>

		<div class="grid gap-10 lg:grid-cols-[1fr_320px]">
			<section class="min-w-0">
				<div class="mb-4 flex items-center justify-between gap-4">
					<h2 class="eyebrow">Proposals</h2>
					<div class="flex flex-wrap items-center gap-3">
						<div class="w-56">
							<SearchInput bind:value={q} placeholder="Filter by title or proposer" />
						</div>
						<div class="flex gap-1">
							{#each [[undefined, 'All'], ['open', 'Open'], ['closed', 'Closed']] as [value, label] (label)}
								<button
									type="button"
									class="rounded-full px-3 py-1 font-mono text-[0.6875rem] tracking-[0.14em] uppercase transition-colors {status ===
									value
										? 'bg-orange-dim text-orange'
										: 'text-ink-dim hover:text-ink'}"
									onclick={() => {
										status = value as typeof status;
										limit = 20;
									}}>{label}</button
								>
							{/each}
						</div>
					</div>
				</div>
				{#if proposals?.error}
					<QueryError error={proposals.error} refresh={() => proposals?.reconnect()} />
				{:else if !proposals?.ready}
					<Skeleton height="h-24" />
				{:else if proposals.current.total === 0}
					<EmptyState>{status ? `No ${status} proposals.` : 'Nothing proposed yet.'}</EmptyState>
				{:else}
					<List>
						{#each proposals.current.items as p (p.id)}
							<ListItem href="/proposals/{p.id}" padding="md" class="min-w-0">
								<div class="min-w-0 flex-1">
									<div class="truncate font-display text-[15px] font-bold">{p.title}</div>
									<div
										class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-ink-dim"
									>
										<PartyId party={p.proposer} />
										<span>{dateOf(p.createdAt)}</span>
									</div>
									<div class="mt-2 flex flex-wrap items-center gap-1.5">
										<span class={tag}><EffectLabel effect={p.effect} equal={d.equal} /></span>
										<span class={tag}>{categoryOf(p.effect.kind)}</span>
										<span class={tag}
											>{p.yes + p.no + p.abstain === 0
												? 'no votes yet'
												: `${pct(p.yes + p.no + p.abstain, p.eligible)}% voted`}</span
										>
										{#if !p.outcome}<span class={tag}>closes {relative(p.closesAt)}</span>{/if}
									</div>
								</div>
								<StatusBadge outcome={p.outcome} closesAt={p.closesAt} executedAt={p.executedAt} />
								<ArrowRight
									size={16}
									class="text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
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

			<aside class="min-w-0 space-y-6">
				{#if d.actorPays}
					<Panel padding="sm" class="space-y-2">
						<h2 class="eyebrow flex items-center gap-1.5">
							Who pays <Hint
								text="This DAO has no balance of its own: a proposal, a vote or a comment costs the member who signs it, from the balance on their Wallet page, and the counting and carrying out of a proposal cost its proposer."
							/>
						</h2>
						<p class="text-[13px] text-ink-mid">
							Each member pays for what they sign, from their own balance on their Wallet page.
						</p>
					</Panel>
				{:else}
					<BalancePanel dao={d.id} />
				{/if}

				<div>
					<SectionTitle title="How proposals pass" />
					<SettingsSummary
						routine={d.routine}
						sensitive={d.sensitive}
						eligible={d.units}
						equal={d.equal}
						compact
					/>
				</div>

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
									<span class="flex shrink-0 items-center gap-2">
										{#if !d.equal}<span class="text-ink">{pct(m.share, d.units)}%</span>{/if}
										{#if m.party === d.creator}<RoleTag role="creator" />{/if}
									</span>
								</ListItem>
							{/each}
						</List>
					{:else}
						<Skeleton height="h-24" />
					{/if}
					<Button href="/daos/{d.id}/members" variant="outline" size="sm" class="mt-3 w-full">
						All members
						<ArrowRight size={14} />
					</Button>
				</div>
			</aside>
		</div>
	{/if}
</Page>
