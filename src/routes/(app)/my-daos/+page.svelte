<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import DaoCard from '$lib/components/dao-card.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import StateMessage from '$lib/components/state-message.svelte';
	import FilterTabs from '$lib/components/filter-tabs.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import PartyId from '$lib/components/party-id.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import { fmt } from '$lib/format';

	const who = $derived(store.who);
	const daos = $derived(who ? remote.myDaos(who.party) : null);
	// What waits on the viewer's vote comes first: it is the reason to open this page.
	const all = $derived(
		[...(daos?.current ?? [])].sort((a, b) => Number(b.awaiting > 0) - Number(a.awaiting > 0))
	);
	const created = $derived(all.filter((d) => d.creator === who?.party).length);
	const due = $derived(all.filter((d) => d.awaiting > 0));
	// A member of hundreds of DAOs finds one by name; the grid grows on request.
	let q = $state('');
	let shown = $state(30);
	let filter = $state<'all' | 'created' | 'due'>('all');
	const found = $derived(
		all.filter(
			(d) =>
				(filter !== 'due' || d.awaiting > 0) &&
				(filter !== 'created' || d.creator === who?.party) &&
				(!q || d.name.toLowerCase().includes(q.toLowerCase()))
		)
	);
</script>

<svelte:head><title>My DAOs — SyncVotes</title></svelte:head>

<Page width="wide">
	<PageHeader eyebrow="Your DAOs" title="My DAOs" description="DAOs you created or belong to.">
		{#snippet action()}
			{#if who && daos?.ready && daos.current.length > 0}
				<Button href="/daos/create" variant="outline"><Plus strokeWidth={2.5} /> Create DAO</Button>
			{/if}
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
	{:else if daos.current.length === 0}
		<StateMessage variant="dashed" title="No DAOs yet">
			Create one, or share your party ID with a member:
			<span class="mt-2 flex justify-center"><PartyId party={who.party} /></span>
			{#snippet actions()}
				<Button href="/daos/create"><Plus strokeWidth={2.5} /> Create DAO</Button>
			{/snippet}
		</StateMessage>
	{:else}
		{#if due.length > 0}
			<section class="mb-8 border-l-2 border-orange pl-4" aria-label="Not voted">
				<h2 class="eyebrow mb-2 text-orange">Not voted</h2>
				<ul class="space-y-1">
					{#each due as d (d.contractId)}
						<li>
							<a
								href="/daos/{d.id}"
								class="group inline-flex flex-wrap items-center gap-x-2 text-body-sm text-ink hover:text-orange"
							>
								<span class="font-bold">{d.name}</span>
								<span class="text-ink-mid group-hover:text-orange"
									>{fmt(d.awaiting)}
									{d.awaiting === 1 ? 'open proposal' : 'open proposals'} not voted</span
								>
								<ArrowRight size={14} aria-hidden="true" />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="mb-4 flex flex-wrap items-center gap-3">
			{#if daos.current.length > 12}
				<div class="w-full max-w-sm">
					<SearchInput bind:value={q} placeholder="Search by name" />
				</div>
			{/if}
			<FilterTabs
				label="Show"
				bind:value={filter}
				options={[
					{ value: 'all', label: 'All', count: all.length },
					{ value: 'created', label: 'Created', count: created },
					{ value: 'due', label: 'Not voted', count: due.length }
				]}
			/>
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
					balance={dao.free ? null : dao.balance}
					actorPays={dao.actorPays}
					share={!dao.equal && dao.units > 0
						? Math.round((dao.myShare / dao.units) * 1000) / 10
						: null}
					isPublic={!!dao.public}
					awaiting={dao.awaiting}
					role={dao.creator === who.party ? 'creator' : 'member'}
				/>
			{/each}
		</div>
		{#if found.length === 0}
			<StateMessage variant="dashed"
				>{filter === 'due' ? 'No open proposals need your vote.' : 'No matches.'}</StateMessage
			>
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
</Page>
