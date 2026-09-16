<script lang="ts">
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Panel from '$lib/components/panel.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import EmptyState from '$lib/components/empty-state.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import LoadMore from '$lib/components/load-more.svelte';
	import SearchInput from '$lib/components/search-input.svelte';
	import RoleTag from '$lib/components/role-tag.svelte';
	import MemberImport from '$lib/components/member-import.svelte';
	import SigningProgress from '$lib/components/signing-progress.svelte';
	import { dateOf, fmt } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);

	let q = $state('');
	let limit = $state(50);
	const members = $derived(me ? remote.daoMembers({ id, offset: 0, limit, q }) : null);

	const selected = new SvelteSet<string>();
	let progress = $state({ done: 0, total: 0, what: '' });
	const track = (what: string) => (done: number, total: number) =>
		(progress = { done, total, what });

	async function add(parties: string[]) {
		const contractId = dao?.current?.contractId;
		if (!contractId) return false;
		return flow.act((s, w) =>
			actions.addMembers(s, w, contractId, parties, track('Adding members'))
		);
	}

	async function remove() {
		const contractId = dao?.current?.contractId;
		if (!contractId || selected.size === 0) return;
		const cids = [...selected];
		const ok = await flow.act((s, w) =>
			actions.removeMembers(s, w, contractId, cids, track('Removing members'))
		);
		if (ok) selected.clear();
	}

	const toggle = (cid: string) => (selected.has(cid) ? selected.delete(cid) : selected.add(cid));
</script>

<svelte:head><title>Members — {dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page back={{ href: `/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
	{#if !dao}
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
			description="{fmt(d.members)} {d.members === 1
				? 'party'
				: 'parties'} hold this DAO. Each is named by the hint it chose and the fingerprint of its key."
		/>

		<Problem message={store.problem} />
		<SigningProgress {...progress} />

		{#if d.me.admin}
			<Panel class="mb-8 space-y-3">
				<h2 class="eyebrow">Add members</h2>
				<p class="text-[13px] text-ink-mid">
					Paste party ids — as many as you like. They are checked against the registry first, then
					added a couple of hundred per transaction, each signed by your key.
				</p>
				<MemberImport busy={store.busy} onadd={add} />
			</Panel>
		{/if}

		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<div class="w-full max-w-sm">
				<SearchInput bind:value={q} placeholder="Filter by party id" />
			</div>
			{#if d.me.admin && selected.size > 0}
				<Button variant="destructive" size="sm" disabled={store.busy} onclick={remove}>
					Remove {fmt(selected.size)} selected
				</Button>
			{/if}
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
					<ListItem class="flex items-center gap-3 font-mono text-xs">
						{#if d.me.admin && m.party !== d.admin}
							<input
								type="checkbox"
								class="accent-orange"
								aria-label="Select {m.party}"
								checked={selected.has(m.contractId)}
								onchange={() => toggle(m.contractId)}
							/>
						{/if}
						<PartyId
							party={m.party}
							size="md"
							class="min-w-0 flex-1 {m.party === me ? '[&>span>span:first-child]:text-orange' : ''}"
						/>
						<span class="hidden text-ink-dim sm:inline">since {dateOf(m.since)}</span>
						{#if m.party === d.admin}<RoleTag role="admin" />{/if}
					</ListItem>
				{/each}
			</List>
			<LoadMore
				shown={members.current.items.length}
				total={members.current.total}
				noun="members"
				onmore={() => (limit += 50)}
			/>
		{/if}
	{/if}
</Page>
