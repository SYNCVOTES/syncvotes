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
	import Skeleton from '$lib/components/skeleton.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import ShareTable, { type Row } from '$lib/components/share-table.svelte';

	const f = remote.createDaoForm;
	// The creator holds it all until others are added; the table must add up to a hundred.
	let rows = $state<Row[]>([]);
	$effect(() => {
		if (store.who && rows.length === 0) rows = [{ party: store.who.party, share: 100 }];
	});
	const whole = $derived(
		rows.length > 0 &&
			rows.every((r) => r.share > 0) &&
			Math.round(rows.reduce((s, r) => s + r.share, 0) * 100) === 10000
	);

	// A share is a Daml Decimal: ten places on the ledger, two in the table.
	const enhanced = signedForm(
		f,
		schema,
		({ daoName, description, shares }, { id }) => ({
			choice: 'Account_CreateDAO',
			contractId: store.who!.account,
			args: {
				id,
				daoName,
				description,
				shares: shares.map((r) => ({ _1: r.party, _2: r.share.toFixed(10) }))
			}
		}),
		({ id }) => goto(`/daos/${id}`)
	);
</script>

<svelte:head><title>Create DAO — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="New organisation"
		title="Create DAO"
		description="A DAO is private to its members: only they, and the app as provider, ever see it. Its members hold shares of the vote that add up to a hundred; from here on, shares change only by vote. Every transaction it makes is paid from a balance anyone can fill."
	/>

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form {...enhanced} class="space-y-8">
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

			<FormSection title="Who holds the vote">
				<Field
					label="Shares"
					id="shares"
					hint="You, and whoever else holds a share of the vote. Percents, to two decimals, adding up to 100."
					issues={f.fields.shares.issues()}
				>
					<ShareTable
						name="shares"
						busy={store.busy}
						bind:rows
						fixed={store.who ? [store.who.party] : []}
					/>
				</Field>
			</FormSection>

			<FormActions
				label="Create DAO"
				busy={store.busy || f.pending > 0}
				disabled={!whole}
				cancelHref="/my-daos"
				problem={store.problem}
			/>
		</form>
	{/if}
</Page>
