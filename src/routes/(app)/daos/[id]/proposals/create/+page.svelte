<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import {
		createProposalForm as schema,
		parseOptions,
		shareChanges,
		shareTuples,
		validOptions,
		BATCH
	} from '$lib/schemas';
	import type { Plain } from '$lib/verify';
	import { Input } from '$lib/components/ui/input';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import MemberEditor, { type Row, type Summary } from '$lib/components/member-editor.svelte';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import ImageField from '$lib/components/image-field.svelte';
	import Note from '$lib/components/note.svelte';
	import RuleSettings from '$lib/components/rule-settings.svelte';
	import Hint from '$lib/components/hint.svelte';
	import {
		DEFAULTS,
		categoryOf,
		copySettings,
		describe,
		settingsFields,
		settingsOf,
		settingsToLedger,
		validRule,
		type Settings
	} from '$lib/rules';
	import PieChart from '@lucide/svelte/icons/pie-chart';
	import Users from '@lucide/svelte/icons/users';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import Eye from '@lucide/svelte/icons/eye';
	import Scale from '@lucide/svelte/icons/scale';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import X from '@lucide/svelte/icons/x';
	import { fmt } from '$lib/format';
	import * as v from 'valibot';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);
	const d = $derived(dao?.current ?? null);

	/**
	 * A proposal is what happens when it passes, first; the words come after. The kind is picked
	 * up top, its own fields follow — filled in with what is there today, so a change starts
	 * from the truth — and before signing the page says in one sentence what the ledger will
	 * do: the same sentence the voters will read.
	 */
	type Kind = 'signal' | 'choose' | 'shares' | 'info' | 'dissolve' | 'settings' | 'visibility';
	let kind = $state<Kind>('signal');
	const kinds = $derived([
		{
			value: 'signal',
			title: 'Decision',
			text: 'The DAO takes a position. Nothing else changes.',
			more: "Records the DAO's position on a question: an opinion, an approval, a mandate for someone. Nothing on the ledger changes but the record of the vote itself. For anything that does not need the ledger to act.",
			icon: MessageSquare
		},
		{
			value: 'choose',
			title: 'Choice',
			text: 'The DAO picks one of several options.',
			more: 'Puts two to ten options to the vote; each member picks one, or abstains. The option with the most votes wins if it reaches what the rule you set asks of a yes — more than half of the whole vote, say — and stands alone at the top; a tie decides nothing. Nothing on the ledger changes but the record of the choice.',
			icon: ListChecks
		},
		d?.equal
			? {
					value: 'shares',
					title: 'Members',
					text: 'Who is in the DAO: parties join or leave.',
					more: "Adds or removes members; every member has one vote. Only the parties you add or remove are put to the vote, everyone else stays as is. A member removed has no vote from the moment this is carried out; a ballot they cast before on a proposal that was already open still counts, since that vote's electorate was fixed when it opened.",
					icon: Users
				}
			: {
					value: 'shares',
					title: 'Shares',
					text: 'Who holds what share of the vote: parties join, leave, gain or lose.',
					more: 'Changes who holds how many units of the vote: parties join with units, leave at zero, or move up or down. Only the parties you touch are put to the vote. A member whose units change cannot vote on proposals that were open before the change was made, so nobody votes twice with two different weights.',
					icon: PieChart
				},
		{
			value: 'info',
			title: 'Name & description',
			text: 'A new name, description or picture.',
			more: 'Renames the DAO, rewrites its description in Markdown, or changes its picture. The fields start with what is there today; what you leave as is stays as is.',
			icon: Pencil
		},
		{
			value: 'settings',
			title: 'Voting rules',
			text: 'How the DAO votes on changes to itself.',
			more: "Changes the DAO's voting rules: for anything that changes the DAO — members, name, these rules, visibility, dissolution — whether the ballot is secret, whether votes may change, what it takes to pass and how long the vote is open. This proposal is itself such a change, so it passes under the rules as they stand today.",
			icon: Scale
		},
		{
			value: 'visibility',
			title: 'Visibility',
			text: d?.public
				? 'Make the DAO private again.'
				: 'Make the DAO public: listed, readable by anyone signed in.',
			more: "Public: listed among the public DAOs, readable by anyone signed in — proposals, outcomes, members, comments — and open to pay-ins; only members act, and who voted how stays with the members. Private: only members see it exists. A change to the DAO, so it passes under the DAO's voting rules.",
			icon: Eye
		},
		{
			value: 'dissolve',
			title: 'Dissolve',
			text: 'The DAO is wound up for good.',
			more: 'Winds the DAO up for good. The moment it passes the DAO is archived: nothing more can be proposed or voted on, what was paid in for it is spent, and its record stays readable.',
			icon: Power
		}
	] as const satisfies readonly {
		value: Kind;
		title: string;
		text: string;
		more: string;
		icon: unknown;
	}[]);

	// A choice's options: two to start with, ten at most; whether a member picks several.
	let options = $state<string[]>(['', '']);
	let several = $state(false);
	const optionList = $derived(options.map((o) => o.trim()).filter(Boolean));

	// What is there today, to start from.
	let newName = $state('');
	let newDescription = $state('');
	let newImage = $state('');
	let seeded = $state(false);
	$effect(() => {
		if (!d || seeded) return;
		seeded = true;
		newName = d.name;
		newDescription = d.description;
		newImage = d.image ?? '';
	});

	// A rules proposal carries the DAO's next settings, starting from today's; a decision or a
	// choice carries its proposer's rule in `newRoutine`, starting from the DAO's routine default.
	let newRoutine = $state<Settings>(copySettings(DEFAULTS.routine));
	let newSensitive = $state<Settings>(copySettings(DEFAULTS.sensitive));
	let settingsSeeded = $state(false);
	$effect(() => {
		if (!d || settingsSeeded) return;
		settingsSeeded = true;
		newRoutine = copySettings(d.routine);
		newSensitive = copySettings(d.sensitive);
	});
	/**
	 * What this proposal runs under: the DAO's rule for anything that changes the DAO; for a
	 * decision or a choice, the rule set below.
	 */
	const own = $derived(categoryOf(kind) === 'routine');
	const applies = $derived(d ? (own ? newRoutine : d.sensitive) : null);

	// The share editor starts as today's table, read once; the rest is the proposer's.
	const today = $derived(store.who && kind === 'shares' ? remote.daoShares(id) : null);
	let rows = $state<Row[]>([]);
	let baseline = $state<Row[]>([]);
	let rowsSeeded = $state(false);
	$effect(() => {
		const t = today?.current;
		if (!t || rowsSeeded) return;
		baseline = t.map((m) => ({ party: m.party, share: m.share, who: m.who }));
		rows = baseline.map((r) => ({ ...r }));
		rowsSeeded = true;
	});
	let summary = $state<Summary>({
		members: 0,
		units: 0,
		joins: 0,
		leaves: 0,
		moved: 0,
		changes: 0,
		valid: false
	});

	const infoChanged = $derived(
		!!d &&
			(newName.trim() !== d.name ||
				newDescription !== d.description ||
				(newImage.trim() || null) !== d.image)
	);

	/** What the ledger will do, in the voters' words. */
	const outcome = $derived.by(() => {
		switch (kind) {
			case 'shares': {
				if (!summary.valid && summary.changes === 0)
					return 'Nothing changes yet — edit the table below.';
				if (!summary.valid)
					return 'The change is not whole: a DAO keeps at least one member with a share.';
				const parts = [];
				if (summary.joins)
					parts.push(
						`${fmt(summary.joins)} ${summary.joins === 1 ? 'party joins' : 'parties join'}`
					);
				if (summary.leaves)
					parts.push(
						`${fmt(summary.leaves)} ${summary.leaves === 1 ? 'member leaves' : 'members leave'}`
					);
				if (summary.moved)
					parts.push(
						`${fmt(summary.moved)} ${summary.moved === 1 ? 'share changes' : 'shares change'}`
					);
				return `${parts.join(', ')}; ${fmt(summary.members)} ${summary.members === 1 ? 'member' : 'members'} after${d?.equal ? '' : `, ${fmt(summary.units)} units in all`}.${summary.changes > BATCH ? ` Carried out in ${Math.ceil(summary.changes / BATCH)} batches.` : ''}`;
			}
			case 'info':
				if (!newName.trim()) return 'Give the DAO its name below.';
				if (!infoChanged) return 'Nothing changes yet — edit the name, description or picture.';
				return `The DAO is ${newName.trim() !== d?.name ? `renamed to “${newName.trim()}”` : 'kept as is'}${newDescription !== d?.description ? ', with a new description' : ''}${(newImage.trim() || null) !== d?.image ? (newImage.trim() ? ', with a new picture' : ', without a picture') : ''}.`;
			case 'choose':
				if (!validOptions(optionList))
					return optionList.length < 2
						? 'Give at least two options below.'
						: 'Two to ten distinct options, eighty characters each at most.';
				return several
					? `Members pick any of ${fmt(optionList.length)} options; every option that reaches what a yes would need is chosen.`
					: `Members pick one of ${fmt(optionList.length)} options; the one with the most votes wins if it reaches what a yes would need, and stands alone at the top.`;
			case 'visibility':
				return d?.public
					? 'The DAO becomes private: it leaves the public list, and only its members can read it from then on.'
					: 'The DAO becomes public: listed for anyone signed in to read — proposals, outcomes, members, comments. Only members act; who voted how stays with the members.';
			case 'dissolve':
				return 'The DAO is archived the moment this passes: nothing more can be proposed or voted on, what was paid in for it is spent, and its record stays readable.';
			case 'settings':
				return `From then on, a change to the DAO is voted on by ${newSensitive.rule.secret ? 'secret' : 'open'} ballot, votes ${newSensitive.rule.changeable ? 'may change until the deadline' : 'final once cast'}, and passes when ${describe(newSensitive.rule)}, open ${newSensitive.votingDays} days.`;
			default:
				return 'The decision is recorded on the ledger. Nothing else changes.';
		}
	});
	/** A title the proposal can carry if none is typed. */
	const suggested = $derived.by(() => {
		switch (kind) {
			case 'shares':
				return d?.equal ? 'Change the members' : 'Change the shares';
			case 'info':
				return newName.trim() && newName.trim() !== d?.name
					? `Rename to ${newName.trim()}`
					: 'Update the description';
			case 'choose':
				return optionList.length >= 2
					? `Choose: ${optionList.slice(0, 3).join(' / ')}`
					: 'A choice';
			case 'visibility':
				return d?.public ? 'Make the DAO private' : 'Make the DAO public';
			case 'dissolve':
				return 'Dissolve the DAO';
			case 'settings':
				return 'Change the settings';
			default:
				return '';
		}
	});

	// One signature, from the member's own contract; the vote opens as it lands.
	const f = remote.createProposalForm;
	let title = $state('');
	let description = $state('');
	const enhanced = signedForm(
		f,
		schema,
		(fields, { pid, membership, args }) => {
			const action: Plain =
				fields.kind === 'shares'
					? {
							tag: 'SetShares',
							value: {
								changes: shareTuples(v.parse(shareChanges, fields.shares))
							}
						}
					: fields.kind === 'info'
						? {
								tag: 'SetInfo',
								value: {
									daoName: fields.newName.trim(),
									description: fields.newDescription,
									image: fields.newImage || null
								}
							}
						: fields.kind === 'choose'
							? {
									tag: 'Choose',
									value: {
										options: parseOptions(fields.options),
										several: fields.several === 'yes' ? true : null
									}
								}
							: fields.kind === 'visibility'
								? { tag: 'SetPublic', value: { public: fields.newPublic === 'yes' } }
								: fields.kind === 'dissolve'
									? { tag: 'Dissolve', value: {} }
									: fields.kind === 'settings'
										? {
												tag: 'SetSettings',
												value: {
													routine: settingsToLedger(settingsOf(fields, 'newRoutine')),
													sensitive: settingsToLedger(settingsOf(fields, 'newSensitive'))
												}
											}
										: { tag: 'Signal', value: {} };
			return {
				choice: 'Member_Propose',
				contractId: membership,
				args: {
					dao: args.dao,
					pid,
					title: fields.title,
					description: fields.description,
					action,
					secret: null,
					rule: own ? settingsToLedger(settingsOf(fields, 'newRoutine')).rule : null,
					votingDays: own ? settingsToLedger(settingsOf(fields, 'newRoutine')).votingDays : null
				}
			};
		},
		({ pid }) => goto(`/proposals/${pid}`)
	);

	const ready = $derived.by(() => {
		if (!d) return false;
		switch (kind) {
			case 'shares':
				return summary.valid;
			case 'info':
				return newName.trim().length >= 2 && infoChanged;
			case 'choose':
				return validOptions(optionList) && validRule(newRoutine.rule);
			case 'signal':
				return validRule(newRoutine.rule);
			case 'settings':
				return validRule(newSensitive.rule);
			default:
				return true;
		}
	});
</script>

<svelte:head><title>New proposal — SyncVotes</title></svelte:head>

<Page width="narrow" back={{ href: `/daos/${id}`, label: d?.name ?? 'DAO' }}>
	<PageHeader
		eyebrow="New proposal"
		title="Propose"
		description="Every member votes with their share. A change to the DAO runs under its voting rules; for a decision or a choice you set the ballot and the rule yourself. The ledger carries out what passes."
	/>

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !store.who}
		<ConnectPrompt what="propose" />
	{:else if dao?.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else if !d}
		<Skeleton height="h-64" />
	{:else}
		<form {...enhanced} class="space-y-8">
			<input {...f.fields.dao.as('hidden', id)} />
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="title" value={title.trim() || suggested} />
			<input type="hidden" name="options" value={optionList.join('\n')} />
			<input type="hidden" name="several" value={several ? 'yes' : 'no'} />
			<input type="hidden" name="newPublic" value={d.public ? 'no' : 'yes'} />

			<FormSection title="What it does">
				<div class="grid gap-3 sm:grid-cols-2">
					{#each kinds as k (k.value)}
						{@const Icon = k.icon}
						<label
							class="flex cursor-pointer items-start gap-3 border p-4 transition-colors {kind ===
							k.value
								? 'border-orange bg-orange/5'
								: 'border-border hover:border-border-hover'}"
						>
							<input type="radio" class="sr-only" value={k.value} bind:group={kind} />
							<Icon
								size={18}
								class="mt-0.5 shrink-0 {kind === k.value ? 'text-orange' : 'text-ink-dim'}"
								aria-hidden="true"
							/>
							<span class="min-w-0">
								<span class="flex items-center gap-1.5 font-display text-[15px] font-bold"
									>{k.title} <Hint text={k.more} /></span
								>
								<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{k.text}</span>
							</span>
						</label>
					{/each}
				</div>
			</FormSection>

			<FormSection title="The proposal">
				<Field
					label="Title"
					id="title"
					hint={suggested && !title.trim() ? `Left empty, it will be “${suggested}”.` : undefined}
					issues={f.fields.title.issues()}
				>
					<Input
						id="title"
						placeholder={suggested || 'Adopt the Q4 budget'}
						maxlength={120}
						bind:value={title}
					/>
				</Field>
				<Field label="Description" id="description" issues={f.fields.description.issues()}>
					<MarkdownEditor
						name="description"
						id="description"
						bind:value={description}
						maxlength={20_000}
						placeholder="What is being decided, and why. Markdown; pictures by link."
						disabled={store.busy}
					/>
				</Field>
			</FormSection>

			<FormSection title="If it passes">
				{#if kind === 'shares'}
					<Field
						label={d.equal ? 'The members after' : 'The table after'}
						id="shares"
						hint={d.equal
							? "Today's members to start from. Add or remove; only what changes is put to the vote."
							: "Today's holders and units to start from. Add, remove, move; only what changes is put to the vote."}
						issues={f.fields.shares.issues()}
					>
						{#if rowsSeeded}
							<MemberEditor
								mode={d.equal ? 'equal' : 'shares'}
								name="shares"
								emit="diff"
								dao={id}
								busy={store.busy}
								{baseline}
								bind:rows
								bind:summary
							/>
						{:else}
							<Skeleton height="h-24" />
						{/if}
					</Field>
				{:else if kind === 'choose'}
					<Field
						label="Options"
						id="option-0"
						hint="Two to ten, a few words each. Members pick one, or several if the ballot allows it; an abstention takes part without picking."
						issues={f.fields.options.issues()}
					>
						<ol class="space-y-2">
							{#each options, i (i)}
								<li class="flex items-center gap-2">
									<span class="w-5 shrink-0 text-right font-mono text-xs text-ink-dim">{i + 1}</span
									>
									<Input
										id="option-{i}"
										maxlength={80}
										placeholder={i === 0 ? 'Telecaster' : i === 1 ? 'Stratocaster' : ''}
										class="flex-1"
										disabled={store.busy}
										bind:value={options[i]}
									/>
									{#if options.length > 2}
										<button
											type="button"
											class="p-1 text-ink-dim hover:text-red"
											aria-label="Remove option {i + 1}"
											onclick={() => (options = options.filter((_, j) => j !== i))}
											><X size={14} /></button
										>
									{/if}
								</li>
							{/each}
						</ol>
						{#if options.length < 10}
							<button
								type="button"
								class="mt-2 font-mono text-xs text-ink-dim underline hover:text-ink"
								onclick={() => (options = [...options, ''])}>Add an option</button
							>
						{/if}
					</Field>
				{:else if kind === 'info'}
					<Field label="Name" id="newName" issues={f.fields.newName.issues()}>
						<Input
							{...f.fields.newName.as('text')}
							id="newName"
							maxlength={60}
							bind:value={newName}
						/>
					</Field>
					<Field label="Description" id="newDescription" issues={f.fields.newDescription.issues()}>
						<MarkdownEditor
							name="newDescription"
							id="newDescription"
							bind:value={newDescription}
							maxlength={10_000}
							placeholder="Leave empty to clear it"
							disabled={store.busy}
						/>
					</Field>
					<Field label="Picture" id="newImage" issues={f.fields.newImage.issues()}>
						<ImageField name="newImage" id="newImage" bind:value={newImage} disabled={store.busy} />
					</Field>
				{:else if kind === 'settings'}
					{#each settingsFields('newRoutine', newRoutine) as [name, value] (name)}
						<input type="hidden" {name} {value} />
					{/each}
					<h3 class="eyebrow">Ballot</h3>
					<RuleSettings
						bind:settings={newSensitive}
						prefix="newSensitive"
						part="ballot"
						eligible={d.units}
						equal={d.equal}
					/>
					<h3 class="eyebrow">How it passes</h3>
					<RuleSettings
						bind:settings={newSensitive}
						prefix="newSensitive"
						eligible={d.units}
						equal={d.equal}
					/>
				{/if}

				<Note mono={false}>{outcome}</Note>
			</FormSection>

			<FormSection title="Ballot">
				{#if own}
					<p class="text-sm leading-relaxed text-ink-mid">
						How members vote on this one. You choose, since a decision or a choice changes nothing
						on the ledger.
					</p>
					<RuleSettings
						bind:settings={newRoutine}
						prefix="newRoutine"
						part="ballot"
						eligible={d.units}
						equal={d.equal}
					>
						{#snippet extra()}
							{#if kind === 'choose'}
								<div
									class="grid items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
								>
									<span
										class="flex items-center gap-1.5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase"
										>Several options <Hint
											text="Each member picks any number of options. Each option is measured on its own against the rule below; every one that reaches it is chosen. Where the rule counts the votes cast, an option is measured against the ballots that picked anything."
										/></span
									>
									<label class="flex items-center gap-2 text-sm">
										<input
											type="checkbox"
											class="accent-orange"
											aria-label="Members may pick several options"
											bind:checked={several}
										/>
										<span class="text-ink-mid">a member may pick more than one</span>
									</label>
								</div>
							{/if}
						{/snippet}
					</RuleSettings>
				{:else if applies}
					<p class="text-sm leading-relaxed text-ink-mid">
						Set by the DAO for every change to it: {applies.rule.secret
							? 'a secret ballot'
							: 'an open ballot'}, and votes {applies.rule.changeable
							? 'may change until the deadline'
							: 'cannot be changed once cast'}.
					</p>
				{/if}
			</FormSection>

			<FormSection title="How it passes">
				{#if own}
					<p class="text-sm leading-relaxed text-ink-mid">
						What it takes and for how long, also yours to set; it starts from the DAO's default.
					</p>
					<RuleSettings
						bind:settings={newRoutine}
						prefix="newRoutine"
						eligible={d.units}
						equal={d.equal}
					/>
				{:else if applies}
					<p class="text-sm leading-relaxed text-ink-mid">
						This changes the DAO, so it runs under the DAO's voting rules: it passes when {describe(
							applies.rule
						)}{applies.rule.early
							? ', settling early once that is sure'
							: ', decided at the deadline'}. The vote is open for {applies.votingDays}
						{applies.votingDays === 1 ? 'day' : 'days'} from the moment you sign.
						<Hint
							text="Set when the DAO was founded, changed only by a Voting rules proposal that passes under them. No proposer chooses them."
						/>
					</p>
				{/if}
			</FormSection>

			<p class="font-mono text-xs text-ink-dim">
				The vote opens for the {fmt(d.members)} current {d.members === 1
					? 'member'
					: 'members'}{d.equal ? '' : `, ${fmt(d.units)} units`}, the moment you sign.
			</p>

			<FormActions
				label="Create proposal"
				busy={store.busy || f.pending > 0}
				disabled={!ready}
				cancelHref="/daos/{id}"
				problem={store.problem}
			/>
		</form>
	{/if}
</Page>
