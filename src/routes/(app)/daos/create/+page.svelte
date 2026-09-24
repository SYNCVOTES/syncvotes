<script lang="ts">
	import { goto } from '$app/navigation';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { createDaoForm as schema, shareTuples, BATCH } from '$lib/schemas';
	import { Input } from '$lib/components/ui/input';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import MemberEditor, { type Row, type Summary } from '$lib/components/member-editor.svelte';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import ImageField from '$lib/components/image-field.svelte';
	import Note from '$lib/components/note.svelte';
	import Hint from '$lib/components/hint.svelte';
	import RuleSettings from '$lib/components/rule-settings.svelte';
	import {
		DEFAULTS,
		copySettings,
		settingsFields,
		settingsOf,
		settingsToLedger,
		validRule,
		type Settings
	} from '$lib/rules';
	import Users from '@lucide/svelte/icons/users';
	import PieChart from '@lucide/svelte/icons/pie-chart';
	import { fmt } from '$lib/format';

	const f = remote.createDaoForm;
	/**
	 * Two kinds of DAO, chosen once: by membership, where every member has one vote, or by
	 * shares, where members hold units of the vote. The founding table is the creator's to
	 * write; from then on it changes only by vote.
	 */
	type Mode = 'equal' | 'shares';
	let mode = $state<Mode>('equal');
	/** Who pays the traffic: the DAO's own balance, or each member for what they sign. */
	let payer = $state<'dao' | 'members'>('dao');
	/** Who may read it: its members, or anyone signed in to the app. */
	let visibility = $state<'private' | 'public'>('private');
	const visibilities = [
		{
			value: 'private',
			title: 'Private',
			text: 'Only its members see it exists.',
			more: 'The DAO, its proposals, votes and comments reach its members and the app that hosts them; nothing about it is listed anywhere or readable by anyone else.'
		},
		{
			value: 'public',
			title: 'Public',
			text: 'Listed for anyone signed in to read; only members act.',
			more: 'Listed among the public DAOs: anyone signed in to the app can read its proposals, outcomes, members and comments, and pay in to its balance. Only members propose, vote and comment; who voted how stays with the members. Say in the description how one joins. Changed later by a Visibility proposal.'
		}
	] as const;
	const payers = [
		{
			value: 'dao',
			title: 'The DAO pays',
			text: 'One balance, paid in by anyone; every transaction in the DAO comes out of it.',
			more: 'The DAO gets a balance of its own with an address and a memo; anyone tops it up. Proposals, votes, comments and the counting are all paid from it, and when it is empty nothing can be signed until someone pays in.'
		},
		{
			value: 'members',
			title: 'Each member pays',
			text: 'Everyone pays for what they sign, from their own balance on their Wallet page.',
			more: 'No DAO balance: a proposal, a vote or a comment costs the member who signs it, and the counting and carrying out of a proposal cost its proposer. A member whose own balance is empty cannot act here until they pay in. Cannot be changed later.'
		}
	] as const;
	const modes = [
		{
			value: 'equal',
			title: 'By membership',
			text: 'One member, one vote. A club, a committee, a collective.',
			more: 'Every member holds exactly one unit of the vote, so a proposal is decided by heads. Members join and leave by vote. Simple, and impossible to skew: nobody can hold more than anyone else.',
			icon: Users
		},
		{
			value: 'shares',
			title: 'By shares',
			text: 'Members hold units of the vote — 40 of 100, say. A company, a fund, a partnership.',
			more: "Members hold units of the vote, whole numbers you set, like shares of a company: 60, 30 and 10 units give 60%, 30% and 10% of the vote. A ballot weighs the voter's units. Units move only by vote; paying the DAO's balance in does not change them.",
			icon: PieChart
		}
	] as const;
	let rows = $state<Row[]>([]);
	let summary = $state<Summary>({
		members: 0,
		units: 0,
		joins: 0,
		leaves: 0,
		moved: 0,
		changes: 0,
		valid: false
	});
	$effect(() => {
		if (store.who && rows.length === 0) rows = [{ party: store.who.party, share: 1 }];
	});
	let description = $state('');
	let image = $state('');
	// The rule everything that changes the DAO passes by, starting from the founding default. A
	// decision or a choice runs under a rule its proposer sets, so the DAO's routine settings go
	// along unchanged, as the founding default a proposer's form starts from.
	const routine = copySettings(DEFAULTS.routine);
	let sensitive = $state<Settings>(copySettings(DEFAULTS.sensitive));

	// The intent is the founding table as the ledger reads it: the first batch of rows, and the
	// rest as a proposal already passed. The server orders the creator first; so does this.
	const enhanced = signedForm(
		f,
		schema,
		(fields, { id }) => {
			const { daoName, description, image, equal, shares } = fields;
			const me = store.who!.party;
			const ordered = [
				...shares.filter((r) => r.party === me),
				...shares.filter((r) => r.party !== me)
			];
			return {
				choice: 'Account_CreateDAO',
				contractId: store.who!.account,
				args: {
					id,
					daoName,
					description,
					image: image || null,
					equal: equal === 'yes',
					actorPays: payer === 'members',
					public: visibility === 'public',
					routine: settingsToLedger(settingsOf(fields, 'routine')),
					sensitive: settingsToLedger(settingsOf(fields, 'sensitive')),
					shares: shareTuples(ordered.slice(0, BATCH)),
					more: shareTuples(ordered.slice(BATCH))
				}
			};
		},
		({ id }) => goto(`/daos/${id}`)
	);
</script>

<svelte:head><title>Create DAO — SyncVotes</title></svelte:head>

<Page width="narrow">
	<PageHeader
		eyebrow="New organisation"
		title="Create DAO"
		description="A DAO is private to its members unless it chooses to be public, in which case anyone signed in can read it and only members act. Everything it does costs network traffic, paid from a balance topped up by sending Canton Coin to the app with a memo. From here on, everything about it changes by vote."
	/>

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form {...enhanced} class="space-y-8">
			<input type="hidden" name="equal" value={mode === 'equal' ? 'yes' : 'no'} />
			<input type="hidden" name="actorPays" value={payer === 'members' ? 'yes' : 'no'} />
			<input type="hidden" name="public" value={visibility === 'public' ? 'yes' : 'no'} />

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
					<MarkdownEditor
						name="description"
						id="description"
						bind:value={description}
						maxlength={10_000}
						placeholder="What this DAO is for, in Markdown. Pictures by link."
						disabled={store.busy}
					/>
				</Field>
				<Field label="Picture" id="image" issues={f.fields.image.issues()}>
					<ImageField name="image" id="image" bind:value={image} disabled={store.busy} />
				</Field>
			</FormSection>

			<FormSection title="How it votes">
				<div class="grid gap-3 sm:grid-cols-2">
					{#each modes as m (m.value)}
						{@const Icon = m.icon}
						<label
							class="flex cursor-pointer items-start gap-3 border p-4 transition-colors {mode ===
							m.value
								? 'border-orange bg-orange/5'
								: 'border-border hover:border-border-hover'}"
						>
							<input type="radio" class="sr-only" value={m.value} bind:group={mode} />
							<Icon
								size={18}
								class="mt-0.5 shrink-0 {mode === m.value ? 'text-orange' : 'text-ink-dim'}"
								aria-hidden="true"
							/>
							<span class="min-w-0">
								<span class="flex items-center gap-1.5 font-display text-[15px] font-bold"
									>{m.title}
									<Hint text={m.more} align={m.value === 'shares' ? 'end' : 'start'} /></span
								>
								<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{m.text}</span>
							</span>
						</label>
					{/each}
				</div>
				<Note mono={false}>
					This cannot be changed later: a DAO by membership stays one, and so does one by shares.
					Who is in it, and with how many units, changes by vote.
				</Note>
			</FormSection>

			<FormSection title="Who can see it">
				<div class="grid gap-3 sm:grid-cols-2">
					{#each visibilities as o (o.value)}
						<label
							class="flex cursor-pointer items-start gap-3 border p-4 transition-colors {visibility ===
							o.value
								? 'border-orange bg-orange/5'
								: 'border-border hover:border-border-hover'}"
						>
							<input type="radio" class="sr-only" value={o.value} bind:group={visibility} />
							<span class="min-w-0">
								<span class="flex items-center gap-1.5 font-display text-[15px] font-bold"
									>{o.title}
									<Hint text={o.more} align={o.value === 'public' ? 'end' : 'start'} /></span
								>
								<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{o.text}</span>
							</span>
						</label>
					{/each}
				</div>
			</FormSection>

			<FormSection title="Who pays">
				<div class="grid gap-3 sm:grid-cols-2">
					{#each payers as p (p.value)}
						<label
							class="flex cursor-pointer items-start gap-3 border p-4 transition-colors {payer ===
							p.value
								? 'border-orange bg-orange/5'
								: 'border-border hover:border-border-hover'}"
						>
							<input type="radio" class="sr-only" value={p.value} bind:group={payer} />
							<span class="min-w-0">
								<span class="flex items-center gap-1.5 font-display text-[15px] font-bold"
									>{p.title}
									<Hint text={p.more} align={p.value === 'members' ? 'end' : 'start'} /></span
								>
								<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{p.text}</span>
							</span>
						</label>
					{/each}
				</div>
				<Note mono={false}>
					Every transaction costs network traffic; this decides whose balance it comes out of.
					Founding the DAO itself comes out of yours. Cannot be changed later.
				</Note>
			</FormSection>

			<FormSection title="Voting rules">
				<p class="text-xs leading-relaxed text-ink-mid">
					How the DAO votes on changes to itself: its members and shares, its name, these rules,
					whether it is public, and winding it up. Changing them later is itself such a vote. A
					decision or a choice changes nothing, so whoever proposes one sets its ballot and rule
					then.
				</p>
				{#each settingsFields('routine', routine) as [name, value] (name)}
					<input type="hidden" {name} {value} />
				{/each}
				<h3 class="eyebrow">Ballot</h3>
				<RuleSettings
					bind:settings={sensitive}
					prefix="sensitive"
					part="ballot"
					eligible={summary.units}
					equal={mode === 'equal'}
				/>
				<h3 class="eyebrow">How it passes</h3>
				<RuleSettings
					bind:settings={sensitive}
					prefix="sensitive"
					eligible={summary.units}
					equal={mode === 'equal'}
				/>
			</FormSection>

			<FormSection title={mode === 'equal' ? 'Founding members' : 'Founding shares'}>
				<Field
					label={mode === 'equal' ? 'Members' : 'Members and their units'}
					id="shares"
					hint={mode === 'equal'
						? 'You, and whoever else is in from the start. Each has one vote.'
						: 'You, and whoever else holds the vote. Units are whole numbers; a share is units over the total.'}
					issues={f.fields.shares.issues()}
				>
					<MemberEditor
						{mode}
						name="shares"
						busy={store.busy}
						bind:rows
						bind:summary
						fixed={store.who ? [store.who.party] : []}
					/>
				</Field>
				{#if summary.members > BATCH}
					<Note mono={false}>
						The first {fmt(BATCH)} are in from the moment you sign; the other {fmt(
							summary.members - BATCH
						)} are added right after, in batches, as the founding table is carried out.
					</Note>
				{/if}
			</FormSection>

			<FormActions
				label="Create DAO"
				busy={store.busy || f.pending > 0}
				disabled={!summary.valid || !validRule(sensitive.rule)}
				cancelHref="/my-daos"
				problem={store.problem}
			/>
		</form>
	{/if}
</Page>
