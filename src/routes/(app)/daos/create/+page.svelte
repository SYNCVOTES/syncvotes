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
	import RuleSettings from '$lib/components/rule-settings.svelte';
	import { CATEGORIES, DEFAULTS, settingsToLedger, validRule, type Settings } from '$lib/rules';
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
	// What every proposal takes to pass, at the least; a majority of all to start with.
	// What proposals run under, by category; the founding defaults to start from.
	const copy = (x: Settings): Settings => ({
		...x,
		rule: { ...x.rule, threshold: { ...x.rule.threshold } }
	});
	let routine = $state<Settings>(copy(DEFAULTS.routine));
	let sensitive = $state<Settings>(copy(DEFAULTS.sensitive));

	// The intent is the founding table as the ledger reads it: the first batch of rows, and the
	// rest as a proposal already passed. The server orders the creator first; so does this.
	const enhanced = signedForm(
		f,
		schema,
		(fields, { id }) => {
			const { daoName, description, image, equal, shares } = fields;
			const settingsOf = (prefix: 'routine' | 'sensitive'): Settings => {
				const x = fields as unknown as Record<string, unknown>;
				const at = (name: string) => x[prefix + name];
				return {
					rule: {
						basis: at('Basis') as Settings['rule']['basis'],
						threshold:
							at('Threshold') === 'percent'
								? { kind: 'percent', percent: Number(at('Percent')) }
								: at('Threshold') === 'fraction'
									? { kind: 'fraction', num: Number(at('Num')), den: Number(at('Den')) }
									: { kind: 'majority' },
						quorum: Number(at('Quorum')),
						early: at('Early') === 'yes',
						changeable: at('Changeable') === 'yes'
					},
					votingDays: Number(at('Days'))
				};
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
					routine: settingsToLedger(settingsOf('routine')),
					sensitive: settingsToLedger(settingsOf('sensitive')),
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
		description="A DAO is private to its members: only they, and the app as provider, ever see it. Everything it does costs network traffic, paid from a balance anyone can top up by sending Canton Coin to the app with the DAO's memo. From here on, everything about it changes by vote."
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

			<FormSection title="How proposals pass">
				<p class="text-xs leading-relaxed text-ink-mid">
					Two kinds of proposal, two settings: what a vote takes to pass, and how long it is open.
					Nobody who proposes chooses either; changing them later is itself a sensitive proposal.
				</p>
				{#each CATEGORIES as c (c.value)}
					<div class="space-y-2">
						<div class="flex items-center gap-1.5">
							<span class="font-display text-[15px] font-bold">{c.title}</span>
							<Hint text={c.covers} />
							<span class="text-xs text-ink-dim">{c.text}</span>
						</div>
						{#if c.value === 'routine'}
							<RuleSettings
								bind:settings={routine}
								prefix="routine"
								eligible={summary.units}
								equal={mode === 'equal'}
							/>
						{:else}
							<RuleSettings
								bind:settings={sensitive}
								prefix="sensitive"
								eligible={summary.units}
								equal={mode === 'equal'}
							/>
						{/if}
					</div>
				{/each}
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
				disabled={!summary.valid || !validRule(routine.rule) || !validRule(sensitive.rule)}
				cancelHref="/my-daos"
				problem={store.problem}
			/>
		</form>
	{/if}
</Page>
