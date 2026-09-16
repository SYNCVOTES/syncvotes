<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow } from '$lib/wallet-store.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);

	let title = $state('');
	let description = $state('');
	let days = $state(7);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const period = Math.min(30, Math.max(1, Math.round(Number(days) || 0)));
		const ok = await flow.act((signer, who) =>
			actions.createProposal(signer, who, {
				dao: dao!.current!.contractId,
				title,
				description,
				days: period
			})
		);
		if (ok) await goto(`/daos/${id}`);
	}
</script>

<svelte:head><title>New proposal — SyncVotes</title></svelte:head>

<Page width="narrow" back={{ href: `/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
	<PageHeader
		eyebrow="New proposal"
		title="Propose"
		description="Every member gets one vote, Yes or No. The proposal passes when a majority of all members voted Yes, and can be closed as soon as that is settled."
	/>

	{#if !store.who}
		<ConnectPrompt what="propose" />
	{:else}
		<form class="space-y-8" onsubmit={submit}>
			<Problem message={store.problem} />

			<FormSection>
				<Field label="Title" id="title">
					<Input id="title" placeholder="Adopt the Q4 budget" maxlength={120} bind:value={title} />
				</Field>
				<Field label="Description" id="description">
					<Textarea
						id="description"
						rows={6}
						maxlength={5000}
						placeholder="What is being decided, and why."
						bind:value={description}
					/>
				</Field>
				<Field label="Voting period (days)" id="days">
					<Input id="days" type="number" min={1} max={30} class="w-32" bind:value={days} />
				</Field>
			</FormSection>

			<FormActions
				label="Create proposal"
				busy={store.busy}
				disabled={title.trim().length < 2 || !dao?.ready}
				cancelHref="/daos/{id}"
			/>
		</form>
	{/if}
</Page>
