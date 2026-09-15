<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Stat from '$lib/components/app/stat.svelte';
	import StatusBadge from '$lib/components/app/status-badge.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import UnlockForm from '$lib/components/app/unlock-form.svelte';
	import { relative } from '$lib/format';

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
		{@const open = d.proposals.filter((p) => !p.outcome)}
		{@const passed = d.proposals.filter((p) => p.outcome === 'Passed')}
		{@const member = me !== null && d.members.includes(me)}

		<a href="/my-daos" class="eyebrow hover:text-orange">← My DAOs</a>

		<div class="mt-6 mb-10 flex flex-wrap items-start justify-between gap-6">
			<div class="flex items-start gap-5">
				<div
					class="flex size-16 shrink-0 items-center justify-center border border-orange/30 bg-orange-dim font-mono text-sm font-bold tracking-[0.08em] text-orange"
				>
					{d.name.slice(0, 3).toUpperCase()}
				</div>
				<div>
					<div class="mb-2 flex items-center gap-3">
						<h1 class="display text-3xl md:text-4xl">{d.name}</h1>
						{#if me === d.admin}<span
								class="font-mono text-xs font-bold tracking-[0.18em] text-amber uppercase"
								>admin</span
							>
						{:else if member}<span
								class="font-mono text-xs font-bold tracking-[0.18em] text-orange uppercase"
								>member</span
							>{/if}
					</div>
					<p class="max-w-[560px] text-sm leading-relaxed text-ink-mid">
						{d.description || 'No description provided.'}
					</p>
				</div>
			</div>
			{#if member}
				<Button href="/daos/{d.contractId}/proposals/create" size="lg">+ New proposal</Button>
			{:else if store.screen.at === 'locked'}
				<div class="w-72"><UnlockForm /></div>
			{/if}
		</div>

		<div class="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
			<Stat value={d.members.length} label="Members" />
			<Stat value={d.proposals.length} label="Proposals" />
			<Stat value={open.length} label="Active" accent />
			<Stat value={passed.length} label="Passed" />
		</div>

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
							{@const yes = p.ballots.filter((b) => b.vote === 'Yes').length}
							<li>
								<a
									href="/proposals/{p.id}"
									class="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover"
								>
									<div class="min-w-0 flex-1">
										<div class="truncate font-display text-[15px] font-bold">{p.title}</div>
										<div class="mt-1 font-mono text-xs text-ink-dim">
											by {nameOf(p.proposer)} · {p.outcome
												? 'closed'
												: `closes ${relative(p.closesAt)}`} · {yes}/{p.members.length} yes
										</div>
									</div>
									<StatusBadge outcome={p.outcome} closesAt={p.closesAt} />
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<aside>
				<h2 class="eyebrow mb-4">Members</h2>
				<ul class="divide-y divide-border border border-border bg-surface">
					{#each d.members as m (m)}
						<li class="flex items-center justify-between px-4 py-3 font-mono text-xs">
							<span class={m === me ? 'text-orange' : 'text-ink'}>{nameOf(m)}</span>
							{#if m === d.admin}<span class="tracking-[0.14em] text-amber uppercase">admin</span
								>{/if}
						</li>
					{/each}
				</ul>
			</aside>
		</div>
	{/if}
</div>
