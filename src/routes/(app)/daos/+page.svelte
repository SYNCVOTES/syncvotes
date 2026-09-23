<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import DaoCard from '$lib/components/dao-card.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import LoadMore from '$lib/components/load-more.svelte';

	/**
	 * The public DAOs, for anyone signed in: found by name or description, biggest first or
	 * newest, in pages that grow. Reading is free; joining is whatever a DAO's description says.
	 */
	const who = $derived(store.who);
	let q = $state('');
	let sort = $state<'members' | 'newest'>('members');
	let limit = $state(30);
	const daos = $derived(who ? remote.publicDaos({ offset: 0, limit, q, sort }) : null);
</script>

<svelte:head><title>Public DAOs — SyncVotes</title></svelte:head>

<Page width="wide">
	<PageHeader
		eyebrow="Open to read"
		title="Public DAOs"
		description="DAOs that chose to be readable by anyone signed in: their proposals, outcomes, members and comments. Only members act. How to join one, if at all, is for its description to say. Anyone can found a DAO under any name: the real DAO of an organisation is the one the organisation points to from a site or channel it controls."
	/>

	{#if store.screen.at === 'loading'}
		<div class="grid gap-3 md:grid-cols-3">
			{#each [1, 2, 3] as i (i)}<Skeleton height="h-24" />{/each}
		</div>
	{:else if !who || !daos}
		<ConnectPrompt what="browse the public DAOs" />
	{:else if daos.error}
		<QueryError error={daos.error} refresh={() => daos.reconnect()} />
	{:else}
		<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
			<div class="w-full max-w-sm">
				<SearchInput bind:value={q} placeholder="Filter by name or description" />
			</div>
			<div class="flex gap-1">
				{#each [['members', 'Biggest'], ['newest', 'Newest']] as [value, label] (value)}
					<button
						type="button"
						class="rounded-full px-3 py-1 font-mono text-[0.6875rem] tracking-[0.14em] uppercase transition-colors {sort ===
						value
							? 'bg-orange-dim text-orange'
							: 'text-ink-dim hover:text-ink'}"
						onclick={() => {
							sort = value as typeof sort;
							limit = 30;
						}}>{label}</button
					>
				{/each}
			</div>
		</div>
		{#if !daos.ready}
			<div class="grid gap-3 md:grid-cols-3">
				{#each [1, 2, 3] as i (i)}<Skeleton height="h-24" />{/each}
			</div>
		{:else if daos.current.total === 0}
			<EmptyState title={q ? 'Nothing matches that.' : 'No public DAOs yet'}>
				{q ? '' : 'A DAO goes public at its founding, or later by vote.'}
			</EmptyState>
		{:else}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each daos.current.items as dao (dao.contractId)}
					<DaoCard
						id={dao.id}
						name={dao.name}
						description={dao.description}
						image={dao.image}
						members={dao.members}
						openProposals={dao.openProposals}
						balance={null}
						actorPays={dao.actorPays}
						share={null}
						equal={dao.equal}
						role={dao.creator === who.party ? 'creator' : null}
					/>
				{/each}
			</div>
			<LoadMore
				shown={daos.current.items.length}
				total={daos.current.total}
				noun="DAOs"
				onmore={(n) => (limit = n)}
			/>
		{/if}
	{/if}
</Page>
