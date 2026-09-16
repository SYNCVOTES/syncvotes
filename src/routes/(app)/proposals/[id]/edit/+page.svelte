<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { updateProposalForm as schema } from '$lib/schemas';
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

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const proposal = $derived(me ? remote.proposal(id) : null);

	const f = remote.updateProposalForm;
	let loaded = $state(false);
	$effect(() => {
		const p = proposal?.current;
		if (!p || loaded) return;
		f.fields.title.set(p.title);
		f.fields.description.set(p.description);
		loaded = true;
	});

	const enhanced = signedForm(f, schema, () => goto(`/proposals/${id}`));
</script>

<svelte:head><title>Edit proposal — SyncVotes</title></svelte:head>

<Page
	width="narrow"
	back={{ href: `/proposals/${id}`, label: proposal?.current?.title ?? 'Proposal' }}
>
	<PageHeader
		eyebrow="Settings"
		title="Edit proposal"
		description="The text can change until the vote opens; the deadline cannot."
	/>

	{#if !proposal}
		<ConnectPrompt what="edit this proposal" />
	{:else if proposal.error}
		<QueryError error={proposal.error} refresh={() => proposal?.reconnect()} />
	{:else if !proposal.ready}
		<Skeleton height="h-64" />
	{:else if proposal.current.proposer !== me}
		<p class="text-[13px] text-ink-dim">Only the proposer can edit.</p>
	{:else if proposal.current.ready}
		<p class="text-[13px] text-ink-dim">Voting has opened; the text is fixed now.</p>
	{:else}
		<form {...enhanced} class="space-y-8">
			<Problem message={store.problem} />
			<input {...f.fields.proposal.as('hidden', proposal.current.contractId)} />
			<FormSection>
				<Field label="Title" id="title" issues={f.fields.title.issues()}>
					<Input {...f.fields.title.as('text')} id="title" maxlength={120} />
				</Field>
				<Field label="Description" id="description" issues={f.fields.description.issues()}>
					<Textarea
						{...f.fields.description.as('text')}
						id="description"
						rows={8}
						maxlength={5000}
					/>
				</Field>
			</FormSection>
			<FormActions
				label="Save changes"
				busy={store.busy || f.pending > 0}
				cancelHref="/proposals/{id}"
			/>
		</form>
	{/if}
</Page>
