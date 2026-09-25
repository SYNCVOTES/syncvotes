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
	// `?kind=shares` (from the members page) starts on that kind; anything else on a decision.
	const KINDS: Kind[] = [
		'signal',
		'choose',
		'shares',
		'info',
		'dissolve',
		'settings',
		'visibility'
	];
	const asked = page.url.searchParams.get('kind') as Kind | null;
	let kind = $state<Kind>(asked && KINDS.includes(asked) ? asked : 'signal');
	const kinds = $derived([
		{
			value: 'signal',
			title: 'Decision',
			text: 'The DAO takes a position. Nothing else changes.',
			more: "Records the DAO's position, for example an approval or a mandate. Changes nothing on the ledger.",
			icon: MessageSquare
		},
		{
			value: 'choose',
			title: 'Choice',
			text: 'The DAO picks from a list of options.',
			more: '2–10 options. The top option wins if it meets the rule and is not tied. With several picks allowed, every option that meets the rule wins.',
			icon: ListChecks
		},
		d?.equal
			? {
					value: 'shares',
					title: 'Members',
					text: 'Who is in the DAO: parties join or leave.',
					more: 'Only the parties you add or remove are voted on.',
					icon: Users
				}
			: {
					value: 'shares',
					title: 'Shares',
					text: 'Who holds what share of the vote: parties join, leave, gain or lose.',
					more: "Only the parties you change are voted on. Members whose units change can't vote on proposals opened before the change.",
					icon: PieChart
				},
		{
			value: 'info',
			title: 'Name and description',
			text: 'A new name, description or picture.',
			more: 'Fields start with the current values.',
			icon: Pencil
		},
		{
			value: 'settings',
			title: 'Voting rules',
			text: 'How the DAO votes on changes to itself.',
			more: 'Passes under the current voting rules.',
			icon: Scale
		},
		{
			value: 'visibility',
			title: 'Visibility',
			text: d?.public
				? 'Make the DAO private again.'
				: 'Make the DAO public: listed, readable by anyone signed in.',
			more: 'Public: anyone signed in can read it. Private: only members see it.',
			icon: Eye
		},
		{
			value: 'dissolve',
			title: 'Dissolve',
			text: 'Permanently close the DAO.',
			more: 'Nothing more can be proposed or voted on. The remaining balance is lost. The record stays readable.',
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
				if (!summary.valid && summary.changes === 0) return 'No changes yet.';
				if (!summary.valid) return 'A DAO needs at least one member with units.';
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
				return `${parts.join(', ')}; ${fmt(summary.members)} ${summary.members === 1 ? 'member' : 'members'} after${d?.equal ? '' : `, ${fmt(summary.units)} units in all`}.${summary.changes > BATCH ? ` Executed in ${Math.ceil(summary.changes / BATCH)} batches.` : ''}`;
			}
			case 'info':
				if (!newName.trim()) return 'Enter a name.';
				if (!infoChanged) return 'No changes yet.';
				return `The DAO is ${newName.trim() !== d?.name ? `renamed to “${newName.trim()}”` : 'kept as is'}${newDescription !== d?.description ? ', with a new description' : ''}${(newImage.trim() || null) !== d?.image ? (newImage.trim() ? ', with a new picture' : ', without a picture') : ''}.`;
			case 'choose':
				if (!validOptions(optionList))
					return optionList.length < 2
						? 'Add at least two options.'
						: '2–10 distinct options, 80 characters each.';
				return several
					? `Members pick any of ${fmt(optionList.length)} options. Every option that meets the rule wins.`
					: `Members pick one of ${fmt(optionList.length)} options. The top option wins if it meets the rule.`;
			case 'visibility':
				return d?.public ? 'The DAO becomes private.' : 'The DAO becomes public.';
			case 'dissolve':
				return 'The DAO closes permanently. Nothing more can be proposed or voted on. The remaining balance is lost; the record stays readable.';
			case 'settings':
				return `From then on, a change to the DAO is voted on by ${newSensitive.rule.secret ? 'secret' : 'open'} ballot, votes ${newSensitive.rule.changeable ? 'may change until the deadline' : 'final once cast'}, and passes when ${describe(newSensitive.rule)}, open ${newSensitive.votingDays} days.`;
			default:
				return 'Recorded on the ledger. Nothing else changes.';
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
				return 'Change the voting rules';
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
										several: fields.several === 'yes'
									}
								}
							: fields.kind === 'visibility'
								? { tag: 'SetPublic', value: { public: fields.newPublic === 'yes' } }
								: fields.kind === 'dissolve'
									? { tag: 'Dissolve', value: {} }
									: fields.kind === 'settings'
										? {
												tag: 'SetRules',
												value: { rules: settingsToLedger(settingsOf(fields, 'newSensitive')) }
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
					rule: own ? settingsToLedger(settingsOf(fields, 'newRoutine')).rule : null,
					votingDays: own ? settingsToLedger(settingsOf(fields, 'newRoutine')).votingDays : null,
					featuredAppRight: args.featuredAppRight
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

<svelte:head><title>New Proposal — SyncVotes</title></svelte:head>

<Page width="narrow" back={{ href: `/daos/${id}`, label: d?.name ?? 'DAO' }}>
	<PageHeader eyebrow={d?.name ?? 'DAO'} title="New Proposal" />

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !store.who}
		<ConnectPrompt what="propose" />
	{:else if dao?.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else if !d}
		<Skeleton height="h-64" />
	{:else}
		{@const picked = kinds.find((k) => k.value === kind)}
		{#snippet kindButton(k: (typeof kinds)[number])}
			{@const Icon = k.icon}
			{@const danger = k.value === 'dissolve'}
			<label
				class="flex cursor-pointer items-center gap-2 border px-3 py-2.5 text-body-sm transition-colors {kind ===
				k.value
					? danger
						? 'border-red bg-red/[0.06] text-red'
						: 'border-orange bg-orange/5 text-ink'
					: danger
						? 'border-red/30 text-red hover:border-red/60'
						: 'border-border text-ink-mid hover:border-border-hover hover:text-ink'}"
			>
				<input type="radio" class="sr-only" value={k.value} bind:group={kind} />
				<Icon
					size={15}
					class="shrink-0 {danger ? 'text-red' : kind === k.value ? 'text-orange' : 'text-ink-dim'}"
					aria-hidden="true"
				/>
				<span class="min-w-0 truncate font-display font-bold">{k.title}</span>
			</label>
		{/snippet}
		<form {...enhanced} class="space-y-10">
			<input {...f.fields.dao.as('hidden', id)} />
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="title" value={title.trim() || suggested} />
			<input type="hidden" name="options" value={optionList.join('\n')} />
			<input type="hidden" name="several" value={several ? 'yes' : 'no'} />
			<input type="hidden" name="newPublic" value={d.public ? 'no' : 'yes'} />

			<FormSection variant="plain" number="01" title="Type">
				<div>
					<p class="eyebrow mb-2">Decisions and choices</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each kinds.filter((k) => categoryOf(k.value) === 'routine') as k (k.value)}
							{@render kindButton(k)}
						{/each}
					</div>
				</div>
				<div>
					<p class="eyebrow mb-2">Changes to the DAO</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each kinds.filter((k) => k.value === 'shares' || k.value === 'info' || k.value === 'settings' || k.value === 'visibility') as k (k.value)}
							{@render kindButton(k)}
						{/each}
					</div>
				</div>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{#each kinds.filter((k) => k.value === 'dissolve') as k (k.value)}
						{@render kindButton(k)}
					{/each}
				</div>
				{#if picked}
					<p class="flex items-center gap-1.5 text-body-sm text-ink-mid">
						{picked.text}
						<Hint text={picked.more} />
					</p>
				{/if}
			</FormSection>

			<FormSection variant="plain" number="02" title="Details">
				<Field
					label="Title"
					id="title"
					hint={suggested && !title.trim() ? `Default: “${suggested}”` : undefined}
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
						placeholder="What and why. Markdown supported."
						disabled={store.busy}
					/>
				</Field>
			</FormSection>

			{#if kind !== 'signal' && kind !== 'dissolve' && kind !== 'visibility'}
				<FormSection variant="plain" number="03" title="If it passes">
					{#if kind === 'shares'}
						<Field
							label={d.equal ? 'The members after' : 'The table after'}
							id="shares"
							hint={d.equal
								? 'Add or remove members. Only changes are voted on.'
								: 'Add, remove or change units. Only changes are voted on.'}
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
							hint="2–10 options, a few words each."
							issues={f.fields.options.issues()}
						>
							<ol class="space-y-2">
								{#each options, i (i)}
									<li class="flex items-center gap-2">
										<span class="w-5 shrink-0 text-right font-mono text-xs text-ink-dim"
											>{i + 1}</span
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
									onclick={() => (options = [...options, ''])}>Add option</button
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
						<Field
							label="Description"
							id="newDescription"
							issues={f.fields.newDescription.issues()}
						>
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
							<ImageField
								name="newImage"
								id="newImage"
								bind:value={newImage}
								disabled={store.busy}
							/>
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
				</FormSection>
			{/if}

			<FormSection
				variant="plain"
				number={kind !== 'signal' && kind !== 'dissolve' && kind !== 'visibility' ? '04' : '03'}
				title="Voting"
			>
				{#if own}
					<p class="text-body-sm text-ink-mid">Set by you for this proposal.</p>
					<RuleSettings
						bind:settings={newRoutine}
						prefix="newRoutine"
						eligible={d.units}
						equal={d.equal}
						collapsed
					>
						{#snippet ballot()}
							<RuleSettings
								bind:settings={newRoutine}
								prefix="newRoutine"
								part="ballot"
								bare
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
													text="Each option is measured against the rule separately. With 'votes cast', the base is ballots that picked something."
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
						{/snippet}
					</RuleSettings>
				{:else if applies}
					<p class="text-body-sm leading-relaxed text-ink-mid">
						Voting rules: {applies.rule.secret ? 'secret ballot' : 'open ballot'}, votes {applies
							.rule.changeable
							? 'may change'
							: 'final once cast'}. Passes when {describe(applies.rule)}{applies.rule.early
							? '; settles early'
							: '; decided at the deadline'}. Open {applies.votingDays}
						{applies.votingDays === 1 ? 'day' : 'days'}.
						<Hint text="Change them with a Voting rules proposal." />
					</p>
				{/if}
			</FormSection>

			<!-- What passing would do, who votes, and the button: kept in view along the bottom. -->
			<div
				class="sticky bottom-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border bg-[rgba(var(--bg-rgb),0.95)] px-6 py-3 backdrop-blur md:-mx-10 md:px-10"
			>
				<div class="min-w-0 flex-1 basis-72 space-y-1">
					<p class="text-body-sm {kind === 'dissolve' ? 'text-red' : 'text-ink'}">
						<span class="eyebrow mr-1">If it passes</span>
						{outcome}
					</p>
					<p class="font-mono text-xs text-ink-dim">
						The vote opens for the {fmt(d.members)} current {d.members === 1
							? 'member'
							: 'members'}{d.equal ? '' : `, ${fmt(d.units)} units`}, the moment you sign.
					</p>
				</div>
				<FormActions
					label="Create proposal"
					busy={store.busy || f.pending > 0}
					disabled={!ready}
					cancelHref="/daos/{id}"
					problem={store.problem}
				/>
			</div>
		</form>
	{/if}
</Page>
