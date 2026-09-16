<script lang="ts">
	import { goto } from '$app/navigation';
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

	let name = $state('');
	let description = $state('');
	let membersText = $state('');

	const members = $derived(
		membersText
			.split(/[\s,]+/)
			.map((m) => m.trim())
			.filter(Boolean)
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const ok = await flow.act((signer, who) =>
			actions.createDao(signer, who, { name, description, members })
		);
		if (ok) await goto('/my-daos');
	}
</script>

<svelte:head><title>Create DAO — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="New organisation"
		title="Create DAO"
		description="A DAO is private to its members: only they, and the app as provider, ever see it. You are its admin and first member."
	/>

	{#if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form class="space-y-8" onsubmit={submit}>
			<Problem message={store.problem} />

			<FormSection title="Basic information">
				<Field label="Name" id="name">
					<Input
						id="name"
						placeholder="Canton Technical Committee"
						maxlength={60}
						bind:value={name}
					/>
				</Field>
				<Field label="Description" id="description">
					<Textarea
						id="description"
						rows={4}
						placeholder="Governs protocol upgrades and technical parameters..."
						bind:value={description}
					/>
				</Field>
			</FormSection>

			<FormSection title="Members">
				<Field
					label="Additional members"
					id="members"
					hint="Members are named by their SyncVotes name. You can change the list later."
				>
					<Textarea
						id="members"
						rows={3}
						placeholder="Names, separated by spaces or commas — alice bob carol"
						bind:value={membersText}
					/>
				</Field>
			</FormSection>

			<FormActions
				label="Create DAO"
				busy={store.busy}
				disabled={name.trim().length < 2}
				cancelHref="/my-daos"
			/>
		</form>
	{/if}
</Page>
