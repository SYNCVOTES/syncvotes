<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import Page from '$lib/components/page.svelte';
	import StatusBadge from '$lib/components/status-badge.svelte';
	import Problem from '$lib/components/problem.svelte';
	import UnlockForm from '$lib/components/unlock-form.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Monogram from '$lib/components/monogram.svelte';
	import Facts from '$lib/components/facts.svelte';
	import SectionTitle from '$lib/components/section-title.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import RoleTag from '$lib/components/role-tag.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { relative, dateOf } from '$lib/format';
	import { NETWORK } from '$lib/network';

	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(page.params.id!) : null);

	const nameOf = (party: string) => dao?.current?.names[party] ?? party.split('::')[0];
</script>

<svelte:head><title>{dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page width="wide" back={{ href: '/my-daos', label: 'My DAOs' }}>
	{#if !dao}
		<ConnectPrompt what="see this DAO" />
	{:else if dao.error}
		<Problem message={describe(dao.error)} />
	{:else if !dao.ready}
		<Skeleton />
	{:else}
		{@const d = dao.current}
		{@const member = me !== null && d.members.includes(me)}
		{@const admin = me !== null && me === d.admin}

		<div class="flex flex-wrap items-start justify-between gap-6">
			<div class="flex items-start gap-5">
				<Monogram name={d.name} size="lg" />
				<div class="min-w-0">
					<h1 class="display text-3xl md:text-4xl">{d.name}</h1>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<Badge variant="accent">Private</Badge>
						<Badge>Majority</Badge>
						{#if admin}<Badge variant="amber">You are admin</Badge>
						{:else if member}<Badge variant="green">Member</Badge>{/if}
					</div>
					<p class="mt-4 max-w-[600px] text-sm leading-relaxed text-ink-mid">
						{d.description || 'No description provided.'}
					</p>
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if admin}
					<Button href="/daos/{d.id}/edit" variant="outline">Edit</Button>
				{/if}
				{#if member}
					<Button href="/daos/{d.id}/proposals/create"
						><Plus strokeWidth={2.5} /> New proposal</Button
					>
				{:else if store.screen.at === 'locked'}
					<div class="w-72"><UnlockForm /></div>
				{/if}
			</div>
		</div>

		<Facts
			items={[
				{ label: 'Members', value: String(d.members.length) },
				{ label: 'Proposals', value: String(d.proposals.length) },
				{ label: 'Network', value: `Canton ${NETWORK}`, accent: true },
				{ label: 'Established', value: d.createdAt ? dateOf(d.createdAt) : '—' }
			]}
		/>

		<div class="grid gap-10 lg:grid-cols-[1fr_300px]">
			<section>
				<SectionTitle title="Proposals" count={d.proposals.length} />
				{#if d.proposals.length === 0}
					<EmptyState>Nothing proposed yet.</EmptyState>
				{:else}
					<List>
						{#each d.proposals as p (p.contractId)}
							{@const included = me !== null && p.members.includes(me)}
							<!-- A proposal keeps the members it was opened with; one opened before you joined is not yours to open. -->
							<ListItem
								href={included ? `/proposals/${p.id}` : undefined}
								padding="md"
								class={included ? '' : 'flex items-center gap-4 opacity-60'}
							>
								<div class="min-w-0 flex-1">
									<div class="truncate font-display text-[15px] font-bold">{p.title}</div>
									<div class="mt-1 font-mono text-xs text-ink-dim">
										by {nameOf(p.proposer)} · {p.ballots.length}
										{p.ballots.length === 1 ? 'vote' : 'votes'} · {p.outcome
											? 'closed'
											: `closes ${relative(p.closesAt)}`}{included
											? ''
											: ' · opened before you joined'}
									</div>
								</div>
								<StatusBadge outcome={p.outcome} closesAt={p.closesAt} />
								{#if included}
									<ArrowRight
										size={16}
										class="text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
										aria-hidden="true"
									/>
								{/if}
							</ListItem>
						{/each}
					</List>
				{/if}
			</section>

			<aside>
				<SectionTitle title="Members" count={d.members.length} />
				<List>
					{#each d.members as m (m)}
						<ListItem class="font-mono text-xs">
							<div class="flex items-center justify-between gap-3">
								<span class={m === me ? 'text-orange' : 'text-ink'}>{nameOf(m)}</span>
								{#if m === d.admin}<RoleTag role="admin" />{/if}
							</div>
							<PartyId party={m} class="mt-1" />
						</ListItem>
					{/each}
				</List>
			</aside>
		</div>
	{/if}
</Page>
