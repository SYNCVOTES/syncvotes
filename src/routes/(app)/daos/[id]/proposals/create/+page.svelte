<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { createProposalForm as schema } from '$lib/schemas';
	import type { Plain } from '$lib/verify';
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
	import PartyChips from '$lib/components/party-chips.svelte';
	import MemberChips from '$lib/components/member-chips.svelte';
	import { fmt } from '$lib/format';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);

	type Kind = 'signal' | 'payout' | 'members' | 'admins';
	let kind = $state<Kind>('signal');
	let checking = $state(false);
	const kinds: { value: Kind; title: string; text: string; needs?: 'treasury' }[] = [
		{ value: 'signal', title: 'Signal', text: 'A decision, and nothing else happens.' },
		{
			value: 'payout',
			title: 'Payout',
			text: 'Coin from the treasury to a party, paid by the treasury signers once passed.',
			needs: 'treasury'
		},
		{ value: 'members', title: 'Membership', text: 'Parties join or leave when it passes.' },
		{ value: 'admins', title: 'Admins', text: 'Who runs the DAO, when it passes.' }
	];

	// One signature, from the member's own contract; the vote opens as it lands.
	const f = remote.createProposalForm;
	const enhanced = signedForm(
		f,
		schema,
		(fields, { pid, membership, dao: daoCid, closesAt }) => {
			const action: Plain =
				fields.kind === 'payout'
					? {
							tag: 'Payout',
							value: { to: fields.payoutTo, amount: fields.payoutAmount.toFixed(10) }
						}
					: fields.kind === 'members'
						? { tag: 'SetMembers', value: { add: fields.add, remove: fields.remove } }
						: fields.kind === 'admins'
							? { tag: 'SetAdmins', value: { admins: fields.admins } }
							: { tag: 'Signal', value: {} };
			return {
				choice: 'Member_Propose',
				contractId: membership,
				args: {
					dao: daoCid,
					pid,
					title: fields.title,
					description: fields.description,
					closesAt,
					action
				}
			};
		},
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
		description={dao?.current?.voting.kind === 'stake'
			? 'Votes weigh the coin each voter has locked past the deadline. It is decided at the deadline: yes must outweigh no.'
			: 'Every member gets one vote, Yes or No. The proposal passes when a majority of all members voted Yes, fails when that can no longer happen, and is decided by the ballots cast once the deadline passes.'}
	/>

	{#if !store.who}
		<ConnectPrompt what="propose" />
	{:else if dao?.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else}
		<form {...enhanced} class="space-y-8">
			<Problem message={store.problem} />
			<input {...f.fields.dao.as('hidden', id)} />
			<input type="hidden" name="kind" value={kind} />

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

			<FormSection title="What happens when it passes">
				<div class="grid gap-3 sm:grid-cols-2">
					{#each kinds as k (k.value)}
						{@const off = k.needs === 'treasury' && !dao?.current?.treasury}
						<label
							class="border p-4 transition-colors {off
								? 'cursor-not-allowed opacity-50'
								: 'cursor-pointer'} {kind === k.value
								? 'border-orange bg-orange/5'
								: 'border-border hover:border-border-hover'}"
						>
							<input
								type="radio"
								class="sr-only"
								value={k.value}
								bind:group={kind}
								disabled={off}
							/>
							<div class="font-display text-[15px] font-bold">{k.title}</div>
							<p class="mt-1 text-xs leading-relaxed text-ink-mid">
								{k.text}{off ? ' The DAO has no treasury yet.' : ''}
							</p>
						</label>
					{/each}
				</div>

				{#if kind === 'payout'}
					<Field label="Pay to" id="payoutTo" issues={f.fields.payoutTo.issues()}>
						<Input
							{...f.fields.payoutTo.as('text')}
							id="payoutTo"
							placeholder="Party id"
							class="font-mono text-xs"
						/>
					</Field>
					<Field label="Amount (CC)" id="payoutAmount" issues={f.fields.payoutAmount.issues()}>
						<Input
							{...f.fields.payoutAmount.as('number')}
							id="payoutAmount"
							step="any"
							min={0}
							class="w-48"
						/>
					</Field>
				{:else if kind === 'members'}
					<Field label="Add" id="add" issues={f.fields.add.issues()}>
						<PartyChips dao={id} name="add" busy={store.busy} bind:checking />
					</Field>
					<Field label="Remove" id="remove" issues={f.fields.remove.issues()}>
						<MemberChips dao={id} name="remove" busy={store.busy} />
					</Field>
				{:else if kind === 'admins'}
					<Field
						label="Admins"
						id="admins"
						hint="The whole list: whoever is not named stops being admin."
						issues={f.fields.admins.issues()}
					>
						<MemberChips dao={id} name="admins" busy={store.busy} />
					</Field>
				{/if}
			</FormSection>

			{#if dao?.ready && dao.current.voting.kind === 'member'}
				<p class="font-mono text-xs text-ink-dim">
					The vote opens for the {fmt(dao.current.members)} current members the moment you sign.
				</p>
			{/if}

			<FormActions
				label="Create proposal"
				busy={store.busy || f.pending > 0}
				disabled={!dao?.ready || checking}
				cancelHref="/daos/{id}"
			/>
		</form>
	{/if}
</Page>
