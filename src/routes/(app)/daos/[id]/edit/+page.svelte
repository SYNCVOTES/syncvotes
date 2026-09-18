<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { updateDaoForm as schema } from '$lib/schemas';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import DangerZone from '$lib/components/danger-zone.svelte';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);

	const f = remote.updateDaoForm;
	let loaded = $state(false);
	// Fill the form once from the live query; later updates must not overwrite what is typed.
	$effect(() => {
		const d = dao?.current;
		if (!d || loaded) return;
		f.fields.daoName.set(d.name);
		f.fields.description.set(d.description);
		loaded = true;
	});

	const enhanced = signedForm(
		f,
		schema,
		({ daoName, description }) => ({
			choice: 'DAO_Update',
			contractId: dao!.current!.contractId,
			args: { admin: store.who!.party, daoName, description }
		}),
		() => goto(`/daos/${id}`)
	);

	async function remove() {
		const current = dao?.current;
		if (!current) return;
		const ok = await flow.act((s, w) => actions.archiveDao(s, w, current));
		if (ok) await goto('/my-daos');
	}
</script>

<svelte:head><title>Edit {dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page width="narrow" back={{ href: `/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
	<PageHeader
		eyebrow="Settings"
		title="Edit DAO"
		description="Changes are signed by your key like everything else. Members are managed on their own page."
	/>

	{#if !dao}
		<ConnectPrompt what="edit this DAO" />
	{:else if dao.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else if !dao.ready}
		<Skeleton height="h-64" />
	{:else if !dao.current.me.admin}
		<p class="text-[13px] text-ink-dim">Only the admin can edit this DAO.</p>
	{:else}
		<form {...enhanced} class="space-y-8">
			<Problem message={store.problem} />
			<input {...f.fields.dao.as('hidden', id)} />

			<FormSection title="Basic information">
				<Field label="Name" id="daoName" issues={f.fields.daoName.issues()}>
					<Input {...f.fields.daoName.as('text')} id="daoName" maxlength={60} />
				</Field>
				<Field label="Description" id="description" issues={f.fields.description.issues()}>
					<Textarea
						{...f.fields.description.as('text')}
						id="description"
						rows={4}
						maxlength={2000}
					/>
				</Field>
			</FormSection>

			<FormActions
				label="Save changes"
				busy={store.busy || f.pending > 0}
				cancelHref="/daos/{id}"
			/>
		</form>

		<div class="mt-14">
			<DangerZone
				title="Delete DAO"
				text="Archives the DAO on the ledger. Settled proposals stay readable; open ones have to be closed or cancelled first."
				action="Delete DAO"
				confirm="Yes, delete it"
				busy={store.busy}
				onconfirm={remove}
			/>
		</div>
	{/if}
</Page>
