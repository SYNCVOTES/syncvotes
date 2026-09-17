<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { createProposalForm as schema } from '$lib/schemas';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import { fmt } from '$lib/format';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);

	// One signature, from the member's own contract; the provider opens the vote as it lands.
	const f = remote.createProposalForm;
	const enhanced = signedForm(
		f,
		schema,
		({ title, description }, { pid, membership, closesAt }) => ({
			choice: 'Member_Propose',
			contractId: membership,
			args: { pid, title, description, closesAt }
		}),
		({ pid }) => goto(`/proposals/${pid}`)
	);

	// A week is the usual voting period; the field starts there.
	$effect(() => {
		if (f.fields.days.value() === undefined) f.fields.days.set(7);
	});
</script>

<svelte:head><title>New proposal — SyncVotes</title></svelte:head>

<Page width="narrow" back={{ href: `/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
	<PageHeader
		eyebrow="New proposal"
		title="Propose"
		description="Every member gets one vote, Yes or No. The proposal passes when a majority of all members voted Yes, fails when that can no longer happen, and is decided by the ballots cast once the deadline passes."
	/>

	{#if !store.who}
		<ConnectPrompt what="propose" />
	{:else if dao?.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else}
		<form {...enhanced} class="space-y-8">
			<Problem message={store.problem} />
			<input {...f.fields.dao.as('hidden', id)} />

			<FormSection>
				<Field label="Title" id="title" issues={f.fields.title.issues()}>
					<Input
						{...f.fields.title.as('text')}
						id="title"
						placeholder="Adopt the Q4 budget"
						maxlength={120}
					/>
				</Field>
				<Field label="Description" id="description" issues={f.fields.description.issues()}>
					<Textarea
						{...f.fields.description.as('text')}
						id="description"
						rows={6}
						maxlength={5000}
						placeholder="What is being decided, and why."
					/>
				</Field>
				<Field
					label="Voting period (days)"
					id="days"
					hint="1 to 30 days."
					issues={f.fields.days.issues()}
				>
					<Input {...f.fields.days.as('number')} id="days" min={1} max={30} class="w-32" />
				</Field>
			</FormSection>

			{#if dao?.ready}
				<p class="font-mono text-xs text-ink-dim">
					The vote opens for the {fmt(dao.current.members)} current members: two transactions, signed
					one after another.
				</p>
			{/if}

			<FormActions
				label="Create proposal"
				busy={store.busy || f.pending > 0}
				disabled={!dao?.ready}
				cancelHref="/daos/{id}"
			/>
		</form>
	{/if}
</Page>
