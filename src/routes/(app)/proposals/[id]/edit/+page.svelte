<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow, describe } from '$lib/wallet-store.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const proposal = $derived(me ? remote.proposal(id) : null);

	let title = $state('');
	let description = $state('');
	let loaded = $state(false);

	$effect(() => {
		const p = proposal?.current;
		if (!p || loaded) return;
		title = p.title;
		description = p.description;
		loaded = true;
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const contractId = proposal?.current?.contractId;
		if (!contractId) return;
		const ok = await flow.act((signer, who) =>
			actions.updateProposal(signer, who, contractId, { title, description })
		);
		if (ok) await goto(`/proposals/${id}`);
	}
</script>

<svelte:head><title>Edit proposal — SyncVotes</title></svelte:head>

<Page
	width="narrow"
	back={{ href: `/proposals/${id}`, label: proposal?.current?.title ?? 'Proposal' }}
>
	<PageHeader
		eyebrow="Settings"
		title="Edit proposal"
		description="The text can change until the first ballot is cast; the deadline cannot."
	/>

	{#if !proposal}
		<ConnectPrompt what="edit this proposal" />
	{:else if proposal.error}
		<Problem message={describe(proposal.error)} />
	{:else if !proposal.ready}
		<Skeleton height="h-64" />
	{:else if proposal.current.proposer !== me}
		<p class="text-[13px] text-ink-dim">Only the proposer can edit.</p>
	{:else if proposal.current.ballots.length > 0}
		<p class="text-[13px] text-ink-dim">Voting has started; the text is fixed now.</p>
	{:else}
		<form class="space-y-8" onsubmit={save}>
			<Problem message={store.problem} />
			<FormSection>
				<Field label="Title" id="title">
					<Input id="title" maxlength={120} bind:value={title} />
				</Field>
				<Field label="Description" id="description">
					<Textarea id="description" rows={8} maxlength={5000} bind:value={description} />
				</Field>
			</FormSection>
			<FormActions
				label="Save changes"
				busy={store.busy}
				disabled={title.trim().length < 2}
				cancelHref="/proposals/{id}"
			/>
		</form>
	{/if}
</Page>
