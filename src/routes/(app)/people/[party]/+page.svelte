<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import Page from '$lib/components/page.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Avatar from '$lib/components/avatar.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { dateOf, hintOf } from '$lib/format';

	/**
	 * A party as others see it: the name and the face it gave itself, what it wrote about
	 * itself, and its id. Without a profile, the id is all there is.
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
		<div class="flex items-start gap-5">
			<Avatar {who} size="lg" />
			<div class="min-w-0 flex-1">
				<p class="eyebrow">{party === me ? 'You, as others see you' : 'Profile'}</p>
				<h1 class="display mt-2 text-3xl md:text-4xl">{who.name ?? hintOf(party)}</h1>
				<PartyId {party} size="md" class="mt-3" />
			</div>
		</div>
		<div class="mt-8 space-y-4">
			{#if p.exists}
				<Panel padding="lg">
					<Markdown text={p.bio} fallback="Nothing written yet." />
				</Panel>
				<p class="font-mono text-xs text-ink-dim">Profile updated {dateOf(p.updatedAt)}.</p>
			{:else}
				<Panel variant="dashed" padding="lg" class="text-sm text-ink-mid">
					{#if party === me}
						You have no profile yet: others see your party id alone.
					{:else}
						This party has not written a profile; its id is all there is.
					{/if}
				</Panel>
			{/if}
			{#if party === me}
				<Button variant="outline" href="/wallet">Edit your profile</Button>
			{/if}
		</div>
	{/if}
</Page>
