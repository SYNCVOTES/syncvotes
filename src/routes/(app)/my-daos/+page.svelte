<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import DaoCard from '$lib/components/dao-card.svelte';
	import Stat from '$lib/components/stat.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import PartyId from '$lib/components/party-id.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import LoadMore from '$lib/components/load-more.svelte';

	const who = $derived(store.who);
	const daos = $derived(who ? remote.myDaos(who.party) : null);
	const created = $derived(daos?.current?.filter((d) => d.creator === who?.party).length ?? 0);
	// A member of hundreds of DAOs finds one by name; the grid grows on request.
	let q = $state('');
	let shown = $state(30);
	// Only the DAOs with a proposal still waiting on the viewer's vote, when asked.
	let due = $state(false);
	const found = $derived(
		(daos?.current ?? []).filter(
			(d) => (!due || d.awaiting > 0) && (!q || d.name.toLowerCase().includes(q.toLowerCase()))
		)
	);
	const awaiting = $derived(daos?.current?.filter((d) => d.awaiting > 0).length ?? 0);
</script>

<svelte:head><title>My DAOs — SyncVotes</title></svelte:head>

<Page width="wide">
	<PageHeader
		eyebrow="Personal workspace"
		title="My DAOs"
		description="The DAOs the ledger says you are in: as their creator, or admitted by vote."
	>
		{#snippet action()}
			<Button href="/daos/create" size="lg"><Plus strokeWidth={2.5} /> Create DAO</Button>
		{/snippet}
	</PageHeader>

	{#if store.screen.at === 'loading'}
		<div class="grid gap-3 md:grid-cols-3">
			{#each [1, 2, 3] as i (i)}<Skeleton height="h-24" />{/each}
		</div>
	{:else if !who || !daos}
		<ConnectPrompt />
	{:else if daos.error}
		<QueryError error={daos.error} refresh={() => daos.reconnect()} />
	{:else if !daos.ready}
		<div class="grid gap-3 md:grid-cols-3">
			{#each [1, 2, 3] as i (i)}<Skeleton height="h-24" />{/each}
		</div>
	{:else}
		<div class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
			<Stat value={daos.current.length} label="Total" sub="DAOs joined" />
			<Stat value={created} label="Created" sub="by you" />
			<Stat value={daos.current.length - created} label="Admitted" sub="by vote" />
		</div>

		{#if daos.current.length === 0}
			<EmptyState title="No DAOs yet">
				Create one, or give a member your party id to be admitted by vote:
				<span class="inline-block"><PartyId party={who.party} /></span>
			</EmptyState>
		{:else}
			<div class="mb-4 flex flex-wrap items-center gap-3">
				{#if daos.current.length > 12}
					<div class="w-full max-w-sm">
						<SearchInput bind:value={q} placeholder="Filter by name" />
					</div>
				{/if}
				<div class="flex gap-1">
					{#each [[false, 'All'], [true, `Your vote due (${awaiting})`]] as [value, label] (label)}
						<button
							type="button"
							class="rounded-full px-3 py-1 font-mono text-[0.6875rem] tracking-[0.14em] uppercase transition-colors {due ===
							value
								? 'bg-orange-dim text-orange'
								: 'text-ink-dim hover:text-ink'}"
							onclick={() => (due = value as boolean)}>{label}</button
						>
					{/each}
				</div>
			</div>
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each found.slice(0, shown) as dao (dao.contractId)}
					<DaoCard
						id={dao.id}
						name={dao.name}
						description={dao.description}
						image={dao.image}
						members={dao.members}
						openProposals={dao.openProposals}
						balance={dao.balance}
						actorPays={dao.actorPays}
						share={dao.units > 0 ? Math.round((dao.myShare / dao.units) * 1000) / 10 : 0}
						equal={dao.equal}
						isPublic={!!dao.public}
						awaiting={dao.awaiting}
						role={dao.creator === who.party ? 'creator' : 'member'}
					/>
				{/each}
			</div>
			{#if found.length === 0}
				<EmptyState>{due ? 'Nothing waits on your vote.' : 'No DAO matches that.'}</EmptyState>
			{/if}
			{#if found.length > shown || daos.current.length > 12}
				<LoadMore
					shown={Math.min(shown, found.length)}
					total={found.length}
					noun="DAOs"
					onmore={(n) => (shown = n)}
				/>
			{/if}
		{/if}
	{/if}
</Page>
