<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import UnlockForm from '$lib/components/app/unlock-form.svelte';
	import { relative, dateOf } from '$lib/format';
	import { NETWORK } from '$lib/network';

	const dao = $derived(remote.dao(page.params.id!));
	const me = $derived(store.who?.party ?? null);

	const nameOf = (party: string) => dao.current?.names[party] ?? party.split('::')[0];
	const initial = (party: string) => nameOf(party).slice(0, 1).toUpperCase();
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

		<a href="/my-daos" class="eyebrow hover:text-orange">← My DAOs</a>

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
					<Button href="/daos/{d.id}/proposals/create">+ New proposal</Button>
				{:else if store.screen.at === 'locked'}
					<div class="w-72"><UnlockForm /></div>
				{/if}
			</div>
		</div>

		<dl class="my-10 grid grid-cols-2 border-y border-border py-6 md:grid-cols-4">
			{#each [['Members', String(d.members.length)], ['Proposals', String(d.proposals.length)], ['Network', `Canton ${NETWORK}`], ['Established', d.createdAt ? relative(d.createdAt) : '—']] as [label, value], i (label)}
				<div
					class="px-5 {i > 0 ? 'md:border-l md:border-border' : ''} {i === 1
						? 'border-l border-border md:border-l'
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

		<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
			<section class="border border-border bg-surface p-6">
				<div class="mb-5 flex items-center justify-between">
					<h2 class="eyebrow">Proposals</h2>
					<span class="font-mono text-xs text-ink-dim">{d.proposals.length} total</span>
				</div>
				{#if d.proposals.length === 0}
					<div
						class="border border-dashed border-border px-6 py-12 text-center text-[13px] text-ink-dim"
					>
						Nothing proposed yet.
					</div>
				{:else}
					<ul class="divide-y divide-border">
						{#each d.proposals as p (p.contractId)}
							<li>
								<a
									href="/proposals/{p.id}"
									class="group -mx-3 flex items-center gap-4 px-3 py-5 transition-colors hover:bg-surface-hover"
								>
									<div class="min-w-0 flex-1">
										<div class="mb-2">
											<StatusBadge outcome={p.outcome} closesAt={p.closesAt} />
										</div>
										<div class="truncate font-display text-[16px] font-bold">{p.title}</div>
										<div class="mt-1 font-mono text-xs text-ink-dim">
											by {nameOf(p.proposer)} · {p.ballots.length}
											{p.ballots.length === 1 ? 'vote' : 'votes'} · {p.outcome
												? 'closed'
												: `closes ${relative(p.closesAt)}`}
										</div>
									</div>
									<span
										class="text-ink-dim transition-all group-hover:translate-x-0.5 group-hover:text-orange"
										>→</span
									>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<aside class="space-y-6">
				<div class="border border-border bg-surface p-6">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="eyebrow">Members</h2>
						<span class="font-mono text-xs text-ink-dim">{d.members.length}</span>
					</div>
					<ul class="space-y-2">
						{#each d.members as m (m)}
							<li
								class="flex items-center gap-3 border border-border px-3 py-2.5 font-mono text-xs"
							>
								<span
									class="flex size-7 shrink-0 items-center justify-center bg-surface-active text-ink-mid"
									>{initial(m)}</span
								>
								<span class="truncate {m === me ? 'text-orange' : 'text-ink'}">{nameOf(m)}</span>
								{#if m === d.admin}<Badge variant="amber" class="ml-auto">admin</Badge>{/if}
							</li>
						{/each}
					</ul>
				</div>

				<dl class="space-y-5 border border-border bg-surface p-6">
					<div>
						<dt class="eyebrow mb-1">Established</dt>
						<dd class="font-mono text-sm">{d.createdAt ? dateOf(d.createdAt) : 'Before 0.1.3'}</dd>
					</div>
					<div>
						<dt class="eyebrow mb-1">Network</dt>
						<dd class="font-mono text-sm text-orange">Canton {NETWORK}</dd>
					</div>
					<div>
						<dt class="eyebrow mb-1">Contract layer</dt>
						<dd class="font-mono text-sm">Daml · LF 2.2</dd>
					</div>
				</dl>
			</aside>
		</div>
	{/if}
</div>
