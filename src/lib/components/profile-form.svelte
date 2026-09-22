<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { profileForm as schema } from '$lib/schemas';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import Skeleton from './skeleton.svelte';
	import QueryError from './query-error.svelte';
	import Field from './field.svelte';
	import MarkdownEditor from './markdown-editor.svelte';
	import ImageField from './image-field.svelte';
	import Avatar from './avatar.svelte';
	import Problem from './problem.svelte';

	/**
	 * How the party presents itself: a name, a picture, a few words, shown wherever the party
	 * appears in a DAO. Optional; without it the party is its id. Signed by the party's own
	 * key; replaced whole each time.
	 */
	let { party }: { party: string } = $props();
	const profile = $derived(remote.profile(party));
	let name = $state('');
	let avatar = $state('');
	let bio = $state('');
	let seeded = $state(false);
	$effect(() => {
		const p = profile.current;
		if (!p || seeded) return;
		seeded = true;
		if (p.exists) {
			name = p.name;
			avatar = p.avatar ?? '';
			bio = p.bio;
		}
	});
	let open = $state(false);

	const f = remote.profileForm;
	const enhanced = signedForm(
		f,
		schema,
		(fields, r) => ({
			choice: 'Account_SetProfile',
			contractId: store.who!.account,
			args: {
				name: fields.name,
				avatar: fields.avatar || null,
				bio: fields.bio,
				previous: r.previous
			}
		}),
		() => (open = false)
	);
</script>

<div class="space-y-5">
	<div class="flex items-center justify-between gap-4">
		<h2 class="eyebrow">Profile</h2>
		{#if profile.ready && !open}
			<Button variant="outline" size="sm" onclick={() => (open = true)}>
				{profile.current.exists ? 'Edit' : 'Set a name and a picture'}
			</Button>
		{/if}
	</div>

	{#if profile.error}
		<QueryError error={profile.error} refresh={() => profile.reconnect()} />
	{:else if !profile.ready}
		<Skeleton height="h-16" />
	{:else if !open}
		<div class="flex items-center gap-4">
			<Avatar who={{ party, name: name || null, avatar: avatar || null }} size="md" />
			<div class="min-w-0 text-sm">
				<div class="font-display text-lg font-bold">{name || 'No name yet'}</div>
				<p class="text-xs text-ink-dim">
					{profile.current.exists
						? 'Shown wherever your party appears, to anyone signed in who knows your party id.'
						: 'Optional: without it you are your party id, which is enough.'}
				</p>
			</div>
		</div>
	{:else}
		<form {...enhanced} class="space-y-5">
			<Field label="Name" id="name" issues={f.fields.name.issues()}>
				<Input
					{...f.fields.name.as('text')}
					id="name"
					maxlength={60}
					placeholder="Alice Carroll"
					bind:value={name}
				/>
			</Field>
			<Field label="Picture" id="avatar" issues={f.fields.avatar.issues()}>
				<ImageField
					name="avatar"
					id="avatar"
					shape="square"
					bind:value={avatar}
					disabled={store.busy}
				/>
			</Field>
			<Field label="About" id="bio" issues={f.fields.bio.issues()}>
				<MarkdownEditor
					name="bio"
					id="bio"
					bind:value={bio}
					maxlength={2000}
					rows={4}
					placeholder="A few words, in Markdown."
					disabled={store.busy}
				/>
			</Field>
			<p class="text-xs text-ink-dim">
				A contract signed by your key and the app's provider: only you can set or replace it. No DAO
				pays for it; the app carries its traffic. Anyone signed in who knows your party id can see
				it, like a name and a picture on any public profile.
			</p>
			<Problem message={store.problem} />
			<div class="flex items-center gap-3">
				<Button type="submit" disabled={store.busy || f.pending > 0 || !name.trim()}>
					{store.busy ? 'Signing…' : profile.current.exists ? 'Save profile' : 'Create profile'}
				</Button>
				<Button type="button" variant="ghost" onclick={() => (open = false)}>Cancel</Button>
			</div>
		</form>
	{/if}
</div>
