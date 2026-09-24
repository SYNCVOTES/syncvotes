<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Who from '$lib/components/who.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import RoleTag from '$lib/components/role-tag.svelte';
	import { dateOf, fmt } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);

	let q = $state('');
	let limit = $state(50);
	const members = $derived(me ? remote.daoMembers({ id, offset: 0, limit, q }) : null);
	const pct = (units: number, of: number) => (of > 0 ? Math.round((units / of) * 1000) / 10 : 0);
</script>

<svelte:head><title>Members — {dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page back={{ href: `/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
	{#if store.screen.at === 'loading'}
		<Skeleton />
	{:else if !dao}
		<ConnectPrompt what="see the members" />
	{:else if dao.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else if !dao.ready}
		<Skeleton />
	{:else}
		{@const d = dao.current}
		<PageHeader
			eyebrow="Membership"
			title="Members"
			description={d.equal
				? `${fmt(d.members)} ${d.members === 1 ? 'member holds' : 'members hold'} this DAO's vote${d.members === 1 ? '' : ', one vote each'}. Who is in changes by vote.`
				: `${fmt(d.members)} ${d.members === 1 ? 'member holds' : 'members hold'} this DAO's vote, in ${fmt(d.units)} units. Who holds what changes by vote.`}
		/>

		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div class="w-full max-w-sm">
				<SearchInput bind:value={q} placeholder="Filter by name or party id" />
			</div>
		</div>

		{#if members?.error}
			<QueryError error={members.error} refresh={() => members?.reconnect()} />
		{:else if !members?.ready}
			<Skeleton height="h-64" />
		{:else if members.current.total === 0}
			<EmptyState>{q ? 'No member matches that.' : 'No members.'}</EmptyState>
		{:else}
			<List>
				{#each members.current.items as m (m.party)}
					<ListItem class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
						<Who who={m.who} me={m.party === me} size="md" class="min-w-0 flex-1 basis-60" />
						<span class="flex shrink-0 items-center gap-3">
							<span class="text-ink-dim">since {dateOf(m.since)}</span>
							{#if !d.equal}<span class="text-ink-dim">{fmt(m.share)} units</span>{/if}
							{#if m.party === d.creator}<RoleTag role="creator" />{/if}
							{#if !d.equal}<span class="w-14 text-right text-ink">{pct(m.share, d.units)}%</span
								>{/if}
						</span>
					</ListItem>
				{/each}
			</List>
			<LoadMore
				shown={members.current.items.length}
				total={members.current.total}
				noun="members"
				onmore={(n) => (limit = n)}
			/>
		{/if}
	{/if}
</Page>
