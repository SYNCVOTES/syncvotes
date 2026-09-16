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
	import QueryError from '$lib/components/query-error.svelte';
	import SigningProgress from '$lib/components/signing-progress.svelte';
	import { fmt } from '$lib/format';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);

	let title = $state('');
	let description = $state('');
	let days = $state(7);
	const period = $derived(Math.round(Number(days) || 0));
	const periodOk = $derived(period >= 1 && period <= 30);
	let progress = $state({ done: 0, total: 0, what: '' });

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const d = dao?.current;
		if (!d || !periodOk) return;
		let pid = '';
		const ok = await flow.act(async (signer, who) => {
			pid = await actions.createProposal(
				signer,
				who,
				{
					dao: d.contractId,
					daoId: d.id,
					membership: d.me.membership,
					title,
					description,
					days: period
				},
				(done, total) => (progress = { done, total, what: 'Opening the vote' })
			);
		});
		if (ok) await goto(`/proposals/${pid}`);
	}
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
		<form class="space-y-8" onsubmit={submit}>
			<Problem message={store.problem} />
			<SigningProgress {...progress} />

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
				<Field
					label="Voting period (days)"
					id="days"
					hint={periodOk ? '1 to 30 days.' : 'The voting period must be 1 to 30 days.'}
				>
					<Input id="days" type="number" min={1} max={30} class="w-32" bind:value={days} />
				</Field>
			</FormSection>

			{#if dao?.ready}
				<p class="font-mono text-xs text-ink-dim">
					Opening the vote issues a voting right to each of the {fmt(dao.current.members)} members — {Math.ceil(
						dao.current.members / actions.BATCH
					) + 2}
					transactions, signed one after another without further prompts.
				</p>
			{/if}

			<FormActions
				label="Create proposal"
				busy={store.busy}
				disabled={title.trim().length < 2 || !dao?.ready || !periodOk}
				cancelHref="/daos/{id}"
			/>
		</form>
	{/if}
</Page>
