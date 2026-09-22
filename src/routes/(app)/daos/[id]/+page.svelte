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
	import Facts from '$lib/components/facts.svelte';
	import SectionTitle from '$lib/components/section-title.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import RoleTag from '$lib/components/role-tag.svelte';
	import EffectLabel from '$lib/components/effect-label.svelte';
	import { short } from '$lib/rules';
	import Problem from '$lib/components/problem.svelte';
	import BillingPanel from '$lib/components/billing-panel.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { relative, dateOf, fmt, coin } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);

	// The proposal list is paged and filtered on the server; more pages append below.
	let status = $state<'open' | 'closed' | undefined>(undefined);
	let limit = $state(20);
	const proposals = $derived(me ? remote.daoProposals({ id, offset: 0, limit, status }) : null);
	const preview = $derived(me ? remote.daoMembers({ id, offset: 0, limit: 6 }) : null);

	const counted = (p: { yes: number; no: number; abstain: number }) => p.yes + p.no + p.abstain;
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

		<div class="flex flex-wrap items-start justify-between gap-6">
			<div class="flex items-start gap-5">
				<Monogram name={d.name} size="lg" />
				<div class="min-w-0">
					<h1 class="display text-3xl md:text-4xl">{d.name}</h1>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<Badge variant="accent">Private</Badge>
						<Badge>Majority</Badge>
						{#if d.me.creator}<Badge variant="amber">You created it</Badge>{:else}<Badge
								variant="green">Member</Badge
							>{/if}
					</div>
					<p
						class="mt-4 max-w-[600px] text-sm leading-relaxed [overflow-wrap:anywhere] text-ink-mid"
					>
						{d.description || 'No description provided.'}
					</p>
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<Button href="/daos/{d.id}/proposals/create"><Plus strokeWidth={2.5} /> New proposal</Button
				>
			</div>
		</div>

		<div class="mt-8"><Problem message={store.problem} /></div>

		<Facts
			items={[
				{ label: 'Members', value: fmt(d.members) },
				{ label: 'Open', value: fmt(d.openProposals), accent: d.openProposals > 0 },
				{ label: 'Balance', value: coin(d.balance), accent: d.balance <= 0 },
				{ label: 'Established', value: dateOf(d.createdAt) }
			]}
		/>

		<div class="grid gap-10 lg:grid-cols-[1fr_320px]">
			<section>
				<div class="mb-4 flex items-center justify-between gap-4">
					<h2 class="eyebrow">Proposals</h2>
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
				{#if proposals?.error}
					<QueryError error={proposals.error} refresh={() => proposals?.reconnect()} />
				{:else if !proposals?.ready}
					<Skeleton height="h-24" />
				{:else if proposals.current.total === 0}
					<EmptyState>{status ? `No ${status} proposals.` : 'Nothing proposed yet.'}</EmptyState>
				{:else}
					<List>
						{#each proposals.current.items as p (p.id)}
							<ListItem href="/proposals/{p.id}" padding="md">
								<div class="min-w-0 flex-1">
									<div class="truncate font-display text-[15px] font-bold">{p.title}</div>
									<div class="mt-1 font-mono text-xs text-ink-dim">
										by <PartyId party={p.proposer} class="align-middle" /> · {dateOf(p.createdAt)}
										· <EffectLabel effect={p.effect} /> · {short(p.rule)} · {fmt(counted(p))} of {fmt(
											p.eligible
										)} · {p.outcome ? 'closed' : `closes ${relative(p.closesAt)}`}
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
						onmore={() => (limit += 20)}
					/>
				{/if}
			</section>

			<aside class="space-y-6">
				<BillingPanel dao={d.id} />

				<div>
					<SectionTitle title="Members" count={fmt(d.members)} />
					{#if preview?.ready}
						<List>
							{#each preview.current.items as m (m.party)}
								<ListItem class="flex items-center justify-between gap-3 font-mono text-xs">
									<PartyId
										party={m.party}
										class={m.party === me ? '[&>span>span:first-child]:text-orange' : ''}
									/>
									{#if m.party === d.creator}<RoleTag role="creator" />{/if}
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
