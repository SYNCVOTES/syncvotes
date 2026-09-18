<script lang="ts">
	import { goto } from '$app/navigation';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { createDaoForm as schema } from '$lib/schemas';
	import type { Plain } from '$lib/verify';
	import type { Intent } from '$lib/actions';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import PartyChips from '$lib/components/party-chips.svelte';
	import VotingPicker from '$lib/components/voting-picker.svelte';

	const f = remote.createDaoForm;
	let members = $state<string[]>([]);
	let admins = $state<string[]>([]);
	let checking = $state(false);
	let voting = $state<'member' | 'stake'>('member');
	let quorum = $state(0);

	// Admins are picked from among the members; whoever creates the DAO is a member already.
	const me = $derived(store.who?.party ?? '');
	const pool = $derived([me, ...members]);
	const strayAdmins = $derived(admins.filter((a) => !pool.includes(a)));

	// The instrument is the server's to name (the network's coin); everything else is ours, and
	// the voting rule's tag and quorum are checked against what was prepared like any argument.
	const enhanced = signedForm(
		f,
		schema,
		(fields, { id }) => {
			const voting: Plain =
				fields.voting === 'stake'
					? { tag: 'ByStake', value: { quorum: fields.quorum.toFixed(10) } }
					: { tag: 'ByMember', value: {} };
			const args: Intent['args'] = {
				id,
				daoName: fields.daoName,
				description: fields.description,
				members: fields.members,
				admins: fields.admins.length ? fields.admins : [me],
				voting
			};
			return { choice: 'Account_CreateDAO', contractId: store.who!.account, args };
		},
		({ id }) => goto(`/daos/${id}`)
	);
</script>

<svelte:head><title>Create DAO — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="New organisation"
		title="Create DAO"
		description="A DAO is private to its members: only they, and the app as provider, ever see it. You are its first member; name the others, choose who runs it and how it votes. Every transaction it makes is paid from a balance an admin tops up."
	/>

	{#if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form {...enhanced} class="space-y-8">
			<Problem message={store.problem} />
			<input type="hidden" name="voting" value={voting} />
			<input type="hidden" name="n:quorum" value={voting === 'stake' ? quorum : 0} />

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

			<FormSection title="People">
				<Field
					label="Members"
					id="members"
					hint="Party ids of the founding members, besides you. More can join later."
					issues={f.fields.members.issues()}
				>
					<PartyChips name="members" busy={store.busy} bind:parties={members} bind:checking />
				</Field>
				<Field
					label="Admins"
					id="admins"
					hint="Who runs the DAO: members, treasury, settings. Leave empty to be the only admin."
					issues={strayAdmins.length
						? [{ message: 'Every admin has to be among the members' }]
						: f.fields.admins.issues()}
				>
					<PartyChips
						name="admins"
						busy={store.busy}
						placeholder="Party ids of the admins"
						bind:parties={admins}
					/>
				</Field>
			</FormSection>

			<FormSection title="Voting">
				<VotingPicker bind:voting bind:quorum />
			</FormSection>

			<FormActions
				label="Create DAO"
				busy={store.busy || f.pending > 0}
				disabled={checking || strayAdmins.length > 0}
				cancelHref="/my-daos"
			/>
		</form>
	{/if}
</Page>
