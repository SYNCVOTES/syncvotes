<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import UnlockForm from '$lib/components/app/unlock-form.svelte';
	import BackLink from '$lib/components/app/back-link.svelte';
	import PartyId from '$lib/components/app/party-id.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { relative, dateOf } from '$lib/format';
	import { NETWORK } from '$lib/network';

	const dao = $derived(remote.dao(page.params.id!));
	const me = $derived(store.who?.party ?? null);

	const nameOf = (party: string) => dao.current?.names[party] ?? party.split('::')[0];
</script>

<svelte:head><title>{dao.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[1120px] px-6 py-12 md:px-10">
	{#if dao.error}
		<Problem message={describe(dao.error)} />
	{:else if !dao.ready}
		<div class="h-40 animate-pulse border border-border bg-surface"></div>
	{:else}
		{@const d = dao.current}
		{@const member = me !== null && d.members.includes(me)}
		{@const admin = me !== null && me === d.admin}
		{@const facts = [
			['Members', String(d.members.length)],
			['Proposals', String(d.proposals.length)],
			['Network', `Canton ${NETWORK}`],
			['Established', d.createdAt ? dateOf(d.createdAt) : '—']
		]}

		<BackLink href="/my-daos" label="My DAOs" />

		<div class="mt-6 flex flex-wrap items-start justify-between gap-6">
			<div class="flex items-start gap-5">
				<div
					class="flex size-20 shrink-0 items-center justify-center border border-orange/30 bg-orange-dim font-display text-2xl font-extrabold text-orange"
				>
					{d.name.slice(0, 2).toUpperCase()}
				</div>
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

		<dl class="my-10 grid grid-cols-2 border-y border-border py-6 md:grid-cols-4">
			{#each facts as [label, value], i (label)}
				<div
					class="px-5 {i % 2 === 1 ? 'border-l border-border' : ''} {i >= 2
						? 'md:border-l md:border-border'
						: ''}"
				>
					<dd
						class="font-mono text-lg font-bold {label === 'Network' ? 'text-orange' : 'text-ink'}"
					>
						{value}
					</dd>
					<dt class="mt-1 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">{label}</dt>
				</div>
			{/each}
		</dl>

		<div class="grid gap-10 lg:grid-cols-[1fr_300px]">
			<section>
				<div class="mb-4 flex items-center justify-between">
					<h2 class="eyebrow">Proposals</h2>
					<span class="font-mono text-xs text-ink-dim">{d.proposals.length}</span>
				</div>
				{#if d.proposals.length === 0}
					<div
						class="border border-dashed border-border px-6 py-12 text-center text-[13px] text-ink-dim"
					>
						Nothing proposed yet.
					</div>
				{:else}
					<ul class="divide-y divide-border border border-border bg-surface">
						{#each d.proposals as p (p.contractId)}
							<li>
								<a
									href="/proposals/{p.id}"
									class="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover"
								>
									<div class="min-w-0 flex-1">
										<div class="truncate font-display text-[15px] font-bold">{p.title}</div>
										<div class="mt-1 font-mono text-xs text-ink-dim">
											by {nameOf(p.proposer)} · {p.ballots.length}
											{p.ballots.length === 1 ? 'vote' : 'votes'} · {p.outcome
												? 'closed'
												: `closes ${relative(p.closesAt)}`}
										</div>
									</div>
									<StatusBadge outcome={p.outcome} closesAt={p.closesAt} />
									<ArrowRight
										size={16}
										class="text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
										aria-hidden="true"
									/>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<aside>
				<div class="mb-4 flex items-center justify-between">
					<h2 class="eyebrow">Members</h2>
					<span class="font-mono text-xs text-ink-dim">{d.members.length}</span>
				</div>
				<ul class="divide-y divide-border border border-border bg-surface">
					{#each d.members as m (m)}
						<li class="px-4 py-3 font-mono text-xs">
							<div class="flex items-center justify-between gap-3">
								<span class={m === me ? 'text-orange' : 'text-ink'}>{nameOf(m)}</span>
								{#if m === d.admin}<span class="tracking-[0.14em] text-amber uppercase">admin</span
									>{/if}
							</div>
							<PartyId party={m} class="mt-1" />
						</li>
					{/each}
				</ul>
			</aside>
		</div>
	{/if}
</div>
