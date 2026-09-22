<script lang="ts">
	import { goto } from '$app/navigation';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { createDaoForm as schema, BATCH } from '$lib/schemas';
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
	import RulePicker from '$lib/components/rule-picker.svelte';
	import { PRESETS, toLedger, type Rule } from '$lib/rules';
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
			more: "Members hold units of the vote, whole numbers you set, like shares of a company: 60, 30 and 10 units give 60%, 30% and 10% of the vote. A ballot weighs the voter's units. Units move only by vote; pay-ins to the treasury do not change them.",
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
	// What every proposal takes to pass, at the least; a majority of all to start with.
	let rule = $state<Rule>({ ...PRESETS[0].rule!, threshold: { ...PRESETS[0].rule!.threshold } });

	// The intent is the founding table as the ledger reads it: the first batch of rows, and the
	// rest as a proposal already passed. The server orders the creator first; so does this.
	const enhanced = signedForm(
		f,
		schema,
		(fields, { id, args }) => {
			const { daoName, description, image, equal, shares } = fields;
			const charter: Rule = {
				basis: fields.basis,
				threshold:
					fields.threshold === 'percent'
						? { kind: 'percent', percent: fields.percent }
						: { kind: 'majority' },
				quorum: fields.quorum,
				early: fields.early === 'yes',
				changeable: fields.changeable === 'yes'
			};
			const me = store.who!.party;
			const ordered = [
				...shares.filter((r) => r.party === me),
				...shares.filter((r) => r.party !== me)
			];
			const tuple = (r: { party: string; share: number }) => ({ _1: r.party, _2: String(r.share) });
			return {
				choice: 'Account_CreateDAO',
				contractId: store.who!.account,
				args: {
					id,
					daoName,
					description,
					image: image || null,
					equal: equal === 'yes',
					treasury: args.treasury,
					rule: toLedger(charter),
					shares: ordered.slice(0, BATCH).map(tuple),
					more: ordered.slice(BATCH).map(tuple)
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
		description="A DAO is private to its members: only they, and the app as provider, ever see it. It gets a treasury of its own — an address anyone can send Canton Coin to — which pays for everything it does, and which it spends only by vote. From here on, everything about it changes by vote."
	/>

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form {...enhanced} class="space-y-8">
			<input type="hidden" name="equal" value={mode === 'equal' ? 'yes' : 'no'} />

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

			<FormSection title="What it takes to pass">
				<p class="text-xs leading-relaxed text-ink-mid">
					The least any proposal takes to pass. Whoever proposes may ask for more — a bigger
					majority, a quorum, unanimity — never less. Changing this later is itself a proposal,
					passed under this very rule.
				</p>
				<RulePicker bind:rule eligible={summary.units} equal={mode === 'equal'} />
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
				disabled={!summary.valid}
				cancelHref="/my-daos"
				problem={store.problem}
			/>
		</form>
	{/if}
</Page>
