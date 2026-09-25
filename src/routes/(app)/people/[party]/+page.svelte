<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Page from '$lib/components/page.svelte';
	import Avatar from '$lib/components/avatar.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import EntityHeader from '$lib/components/entity-header.svelte';
	import StateMessage from '$lib/components/state-message.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import { Button } from '$lib/components/ui/button';
	import UserRound from '@lucide/svelte/icons/user-round';
	import { dateOf, hintOf } from '$lib/format';

	/**
	 * A party as others see it: the name and the face it gave itself, what it wrote about
	 * itself, and its ID. Without a profile, the ID is all there is.
	 */
	const party = $derived(page.params.party!);
	const me = $derived(store.who?.party ?? null);
	const profile = $derived(me ? remote.profile(party) : null);
</script>

<svelte:head
	><title>{profile?.current?.exists ? profile.current.name : hintOf(party)} — SyncVotes</title
	></svelte:head
>

<Page width="narrow">
	{#if store.screen.at === 'loading'}
		<Skeleton />
	{:else if !profile}
		<ConnectPrompt what="see who this is" />
	{:else if profile.error}
		<QueryError error={profile.error} refresh={() => profile?.reconnect()} />
	{:else if !profile.ready}
		<Skeleton />
	{:else}
		{@const p = profile.current}
		{@const who = { party, name: p.exists ? p.name : null, avatar: p.exists ? p.avatar : null }}
		<EntityHeader
			eyebrow={party === me ? 'Your public profile' : 'Profile'}
			title={who.name ?? hintOf(party)}
		>
			{#snippet media()}<Avatar {who} size="lg" />{/snippet}
			{#snippet meta()}<PartyId {party} />{/snippet}
			{#snippet action()}
				{#if party === me && p.exists}
					<Button variant="outline" href="/wallet">Edit profile</Button>
				{/if}
			{/snippet}
		</EntityHeader>
		{#if p.exists}
			<div class="space-y-4">
				<Markdown text={p.bio} fallback="Nothing written yet." />
				<p class="font-mono text-xs text-ink-dim">Profile updated {dateOf(p.updatedAt)}.</p>
			</div>
		{:else if party === me}
			<StateMessage variant="dashed" icon={UserRound} title="No profile yet">
				Others see only your party ID.
				{#snippet actions()}<Button href="/wallet">Set up profile</Button>{/snippet}
			</StateMessage>
		{:else}
			<StateMessage variant="dashed" icon={UserRound} title="No profile" />
		{/if}
	{/if}
</Page>
