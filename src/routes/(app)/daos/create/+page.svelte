<script lang="ts">
	import { goto } from '$app/navigation';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { createDaoForm as schema } from '$lib/schemas';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';

	const f = remote.createDaoForm;
	const enhanced = signedForm(
		f,
		schema,
		({ daoName, description }, { id }) => ({
			choice: 'Account_CreateDAO',
			contractId: store.who!.account,
			args: { id, daoName, description }
		}),
		({ id }) => goto(`/daos/${id}/members`)
	);
</script>

<svelte:head><title>Create DAO — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="New organisation"
		title="Create DAO"
		description="A DAO is private to its members: only they, and the app as provider, ever see it. You are its admin and first member; members come next, by party id."
	/>

	{#if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form {...enhanced} class="space-y-8">
			<Problem message={store.problem} />

			<FormSection title="Basic information">
				<Field label="Name" id="daoName" issues={f.fields.daoName.issues()}>
					<Input
						{...f.fields.daoName.as('text')}
						id="daoName"
						placeholder="Canton Technical Committee"
						maxlength={60}
					/>
				</Field>
				<Field label="Description" id="description" issues={f.fields.description.issues()}>
					<Textarea
						{...f.fields.description.as('text')}
						id="description"
						rows={4}
						maxlength={2000}
						placeholder="Governs protocol upgrades and technical parameters..."
					/>
				</Field>
			</FormSection>

			<FormActions label="Create DAO" busy={store.busy || f.pending > 0} cancelHref="/my-daos" />
		</form>
	{/if}
</Page>
