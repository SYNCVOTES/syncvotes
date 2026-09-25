<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import DaoCard from '$lib/components/dao-card.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import StateMessage from '$lib/components/state-message.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import FilterTabs from '$lib/components/filter-tabs.svelte';
	import Note from '$lib/components/note.svelte';
	import { Button } from '$lib/components/ui/button';

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
		description="DAOs anyone signed in can read. Only members can act."
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
				<SearchInput bind:value={q} placeholder="Search by name, description or DAO ID" />
			</div>
			<FilterTabs
				label="Sort"
				bind:value={sort}
				onchange={() => (limit = 30)}
				options={[
					{ value: 'members', label: 'Biggest' },
					{ value: 'newest', label: 'Newest' }
				]}
			/>
		</div>
		{#if !daos.ready}
			<div class="grid gap-3 md:grid-cols-3">
				{#each [1, 2, 3] as i (i)}<Skeleton height="h-24" />{/each}
			</div>
		{:else if daos.current.total === 0}
			<StateMessage variant="dashed" title={q ? 'No matches.' : 'No public DAOs yet'}>
				{#snippet actions()}
					{#if !q}<Button href="/app/my-daos" variant="outline">Make one of yours public</Button
						>{/if}
				{/snippet}
			</StateMessage>
		{:else}
			<Note tone="warn" class="mb-6"
				>Anyone can create a DAO under any name. Check a DAO's ID against the organization's own
				site.</Note
			>
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
