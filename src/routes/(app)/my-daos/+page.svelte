<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import DaoCard from '$lib/components/dao-card.svelte';
	import Stat from '$lib/components/stat.svelte';
	import Problem from '$lib/components/problem.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import Plus from '@lucide/svelte/icons/plus';

	const who = $derived(store.who);
	const daos = $derived(who ? remote.myDaos(who.party) : null);
	const admin = $derived(daos?.current?.filter((d) => d.admin === who?.party).length ?? 0);
</script>

<svelte:head><title>My DAOs — SyncVotes</title></svelte:head>

<Page width="wide">
	<PageHeader
		eyebrow="Personal workspace"
		title="My DAOs"
		description="DAOs where your key is admin or member. On-chain membership only — derived from the DAO contracts on Canton Network."
	>
		{#snippet action()}
			<Button href="/daos/create" size="lg"><Plus strokeWidth={2.5} /> Create DAO</Button>
		{/snippet}
	</PageHeader>

	{#if !who || !daos}
		<ConnectPrompt />
	{:else if daos.error}
		<Problem message={describe(daos.error)} />
	{:else if !daos.ready}
		<div class="grid gap-3 md:grid-cols-3">
			{#each [1, 2, 3] as i (i)}<Skeleton height="h-24" />{/each}
		</div>
	{:else}
		<div class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
			<Stat value={daos.current.length} label="Total" sub="DAOs joined" />
			<Stat value={admin} label="Admin" sub="you control" />
			<Stat value={daos.current.length - admin} label="Member" sub="you participate in" />
		</div>

		{#if daos.current.length === 0}
			<EmptyState title="No DAOs yet">
				Create one, or ask a friend to add <span class="font-mono text-ink">{who.name}</span> as a member.
			</EmptyState>
		{:else}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each daos.current as dao (dao.contractId)}
					<DaoCard
						id={dao.id}
						name={dao.name}
						description={dao.description}
						members={dao.members.length}
						openProposals={dao.openProposals}
						role={dao.admin === who.party ? 'admin' : 'member'}
					/>
				{/each}
			</div>
		{/if}
	{/if}
</Page>
