<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/app/page-header.svelte';
	import ConnectPrompt from '$lib/components/app/connect-prompt.svelte';
	import DaoCard from '$lib/components/app/dao-card.svelte';
	import Stat from '$lib/components/app/stat.svelte';
	import Problem from '$lib/components/app/problem.svelte';
	import { describe } from '$lib/wallet-store.svelte';

	const who = $derived(store.who);
	const daos = $derived(who ? remote.myDaos(who.party) : null);
	const admin = $derived(daos?.current?.filter((d) => d.admin === who?.party).length ?? 0);
</script>

<svelte:head><title>My DAOs — SyncVotes</title></svelte:head>

<div class="mx-auto max-w-[1120px] px-6 py-12 md:px-10">
	<PageHeader
		eyebrow="Personal workspace"
		title="My DAOs"
		description="DAOs where your key is admin or member. On-chain membership only — derived from the DAO contracts on Canton Network."
	>
		{#snippet action()}
			<Button href="/daos/create" size="lg">+ Create DAO</Button>
		{/snippet}
	</PageHeader>

	{#if !who || !daos}
		<ConnectPrompt />
	{:else if daos.error}
		<Problem message={describe(daos.error)} />
	{:else if !daos.ready}
		<div class="grid gap-3 md:grid-cols-3">
			{#each [1, 2, 3] as i (i)}<div class="h-24 animate-pulse border border-border bg-surface"></div>{/each}
		</div>
	{:else}
		<div class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
			<Stat value={daos.current.length} label="Total" sub="DAOs joined" />
			<Stat value={admin} label="Admin" sub="you control" />
			<Stat value={daos.current.length - admin} label="Member" sub="you participate in" />
		</div>

		{#if daos.current.length === 0}
			<div class="border border-dashed border-border px-6 py-16 text-center">
				<p class="font-display text-[17px] font-bold">No DAOs yet</p>
				<p class="mt-2 text-[13px] text-ink-dim">
					Create one, or ask a friend to add <span class="font-mono text-ink">{who.name}</span> as a member.
				</p>
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each daos.current as dao (dao.contractId)}
					<DaoCard
						id={dao.contractId}
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
</div>
