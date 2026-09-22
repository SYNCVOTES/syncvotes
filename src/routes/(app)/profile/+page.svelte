<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { profileForm as schema } from '$lib/schemas';
	import { Input } from '$lib/components/ui/input';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import ImageField from '$lib/components/image-field.svelte';
	import Avatar from '$lib/components/avatar.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Note from '$lib/components/note.svelte';

	/**
	 * How the party presents itself: a name, a picture, a few words, shown wherever the party
	 * appears in a DAO. Signed by the party's own key; replaced whole each time.
	 */
	const me = $derived(store.who?.party ?? null);
	const profile = $derived(me ? remote.profile(me) : null);
	let name = $state('');
	let avatar = $state('');
	let bio = $state('');
	let seeded = $state(false);
	$effect(() => {
		const p = profile?.current;
		if (!p || seeded) return;
		seeded = true;
		if (p.exists) {
			name = p.name;
			avatar = p.avatar ?? '';
			bio = p.bio;
		}
	});

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
		() => undefined
	);
</script>

<svelte:head><title>Profile — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="Who you are"
		title="Profile"
		description="A name and a face for your party id, shown to the DAOs you are in. Optional; without it you are your party id, which is enough."
	/>

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !me}
		<ConnectPrompt what="set a profile" />
	{:else if profile?.error}
		<QueryError error={profile.error} refresh={() => profile?.reconnect()} />
	{:else if !profile?.ready}
		<Skeleton height="h-64" />
	{:else}
		<div class="mb-8 flex items-center gap-4">
			<Avatar who={{ party: me, name: name || null, avatar: avatar || null }} size="lg" />
			<div class="min-w-0">
				<div class="font-display text-2xl font-bold">{name || 'No name yet'}</div>
				<PartyId party={me} size="md" />
			</div>
		</div>

		<form {...enhanced} class="space-y-8">
			<FormSection title="Profile">
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
			</FormSection>

			<Note mono={false}>
				Your profile is a contract signed by your key and the app; the traffic it costs is yours,
				not a DAO's. Everything in it is visible to every member of every DAO you are in.
			</Note>

			<FormActions
				label={profile.current.exists ? 'Save profile' : 'Create profile'}
				busy={store.busy || f.pending > 0}
				disabled={!name.trim()}
				cancelHref="/wallet"
				problem={store.problem}
			/>
		</form>
	{/if}
</Page>
