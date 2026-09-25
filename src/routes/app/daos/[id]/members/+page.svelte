<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import EntityHeader from '$lib/components/entity-header.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Who from '$lib/components/who.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import StateMessage from '$lib/components/state-message.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import FilterTabs from '$lib/components/filter-tabs.svelte';
	import RoleTag from '$lib/components/role-tag.svelte';
	import { dateOf, fmt } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);

	let q = $state('');
	let limit = $state(50);
	const members = $derived(me ? remote.daoMembers({ id, offset: 0, limit, q }) : null);
	const pct = (units: number, of: number) => (of > 0 ? Math.round((units / of) * 1000) / 10 : 0);
	// Sorting is offered once the whole list is here, so it never sorts a page as if it were all.
	let sort = $state<'share' | 'newest' | 'oldest'>('share');
	const complete = $derived(
		!!members?.current && members.current.items.length === members.current.total
	);
	const rows = $derived.by(() => {
		const items = [...(members?.current?.items ?? [])];
		if (!complete || sort === 'share') return items;
		return items.sort((a, b) =>
			sort === 'newest' ? b.since.localeCompare(a.since) : a.since.localeCompare(b.since)
		);
	});
</script>

<svelte:head><title>Members — {dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page back={{ href: `/app/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
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
		<EntityHeader eyebrow="Members" title={d.name}>
			{#snippet meta()}
				<span
					>{d.equal
						? `${fmt(d.members)} ${d.members === 1 ? 'member' : 'members'}, one vote each.`
						: `${fmt(d.members)} ${d.members === 1 ? 'member' : 'members'}, ${fmt(d.units)} units.`}</span
				>
			{/snippet}
			{#snippet action()}
				{#if d.me.membership}
					<Button href="/app/daos/{d.id}/proposals/create?kind=shares" variant="outline"
						>Propose a change</Button
					>
				{/if}
			{/snippet}
		</EntityHeader>

		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div class="w-full max-w-sm">
				<SearchInput bind:value={q} placeholder="Search by name or party ID" />
			</div>
			{#if complete && members?.current && members.current.total > 1}
				<FilterTabs
					label="Sort members"
					bind:value={sort}
					options={[
						{ value: 'share', label: d.equal ? 'Default' : 'By share' },
						{ value: 'newest', label: 'Newest' },
						{ value: 'oldest', label: 'Oldest' }
					]}
				/>
			{/if}
		</div>

		{#if members?.error}
			<QueryError error={members.error} refresh={() => members?.reconnect()} />
		{:else if !members?.ready}
			<div class="space-y-1">
				{#each [1, 2, 3, 4] as i (i)}<Skeleton height="h-12" />{/each}
			</div>
		{:else if members.current.total === 0}
			<StateMessage variant="dashed">{q ? 'No matches.' : 'No members.'}</StateMessage>
		{:else}
			<List>
				{#each rows as m (m.party)}
					<ListItem class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
						<Who who={m.who} me={m.party === me} size="md" class="min-w-0 flex-1 basis-60" />
						<span class="flex shrink-0 items-center gap-3">
							{#if m.party === d.creator}<RoleTag role="creator" />{/if}
							<span class="text-ink-dim">since {dateOf(m.since)}</span>
							{#if !d.equal}<span class="text-ink-dim">{fmt(m.share)} units</span>{/if}
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
