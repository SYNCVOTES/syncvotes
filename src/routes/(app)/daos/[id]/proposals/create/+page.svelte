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
	import Skeleton from '$lib/components/skeleton.svelte';
	import FormSection from '$lib/components/form-section.svelte';
	import Field from '$lib/components/field.svelte';
	import FormActions from '$lib/components/form-actions.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ShareTable, { type Row } from '$lib/components/share-table.svelte';
	import Note from '$lib/components/note.svelte';
	import RulePicker from '$lib/components/rule-picker.svelte';
	import { PRESETS, toLedger, type Rule } from '$lib/rules';
	import PieChart from '@lucide/svelte/icons/pie-chart';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { fmt } from '$lib/format';
	import { shareTable } from '$lib/schemas';
	import * as v from 'valibot';

	const parsed = (raw: string) => v.parse(shareTable, raw);

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);

	/**
	 * A proposal is what happens when it passes, first; the words come after. The kind is picked
	 * up top, its own fields follow, and before signing the page says in one sentence what the
	 * ledger will do — the same sentence the voters will read.
	 */
	type Kind = 'signal' | 'shares' | 'info' | 'dissolve';
	let kind = $state<Kind>('signal');
	let newName = $state('');
	let newDescription = $state('');
	let rule = $state<Rule>({ ...PRESETS[0].rule! });
	// A dissolution starts out unanimous; anything else, a majority of all. The author decides.
	let ruleFor = $state<Kind>('signal');
	$effect(() => {
		if (kind === ruleFor) return;
		ruleFor = kind;
		const fallback = PRESETS.find(
			(p) => p.value === (kind === 'dissolve' ? 'unanimous' : 'majority')
		)!.rule!;
		rule = { ...fallback, threshold: { ...fallback.threshold } };
	});
	const kinds = [
		{
			value: 'signal',
			title: 'Decision',
			text: 'The DAO takes a position. Nothing else changes.',
			icon: MessageSquare
		},
		{
			value: 'shares',
			title: 'Shares',
			text: 'Who holds what share of the vote: parties join, leave, gain or lose.',
			icon: PieChart
		},
		{ value: 'info', title: 'Name', text: 'A new name and description.', icon: Pencil },
		{ value: 'dissolve', title: 'Dissolve', text: 'The DAO is wound up for good.', icon: Power }
	] as const;

	const members = $derived(dao?.current?.members ?? 0);
	// The share table starts as today's table, read once; the rest is the proposer's.
	const today = $derived(store.who ? remote.daoMembers({ id, offset: 0, limit: 200 }) : null);
	let rows = $state<Row[]>([]);
	let seeded = $state(false);
	$effect(() => {
		const t = today?.current;
		if (!t || seeded) return;
		rows = t.items.map((m) => ({ party: m.party, share: m.share }));
		seeded = true;
	});
	const whole = $derived(
		rows.length > 0 &&
			rows.every((r) => r.share > 0) &&
			Math.round(rows.reduce((s, r) => s + r.share, 0) * 100) === 10000
	);
	const changes = $derived.by(() => {
		const now = new Map((today?.current?.items ?? []).map((m) => [m.party, m.share]));
		const joins = rows.filter((r) => !now.has(r.party)).length;
		const leaves = [...now.keys()].filter((p) => !rows.some((r) => r.party === p)).length;
		const moved = rows.filter((r) => now.has(r.party) && now.get(r.party) !== r.share).length;
		return { joins, leaves, moved };
	});
	/** What the ledger will do, in the voters' words. */
	const outcome = $derived.by(() => {
		switch (kind) {
			case 'shares': {
				if (!whole)
					return 'The table has to add up to exactly 100% before it can be put to the vote.';
				const parts = [];
				if (changes.joins)
					parts.push(
						`${fmt(changes.joins)} ${changes.joins === 1 ? 'party joins' : 'parties join'}`
					);
				if (changes.leaves)
					parts.push(
						`${fmt(changes.leaves)} ${changes.leaves === 1 ? 'member leaves' : 'members leave'}`
					);
				if (changes.moved)
					parts.push(
						`${fmt(changes.moved)} ${changes.moved === 1 ? 'share changes' : 'shares change'}`
					);
				return parts.length
					? `${parts.join(', ')}; ${fmt(rows.length)} holders after.`
					: 'Nothing changes yet — edit the table below.';
			}
			case 'info':
				return newName.trim()
					? `The DAO is renamed to “${newName.trim()}”${newDescription.trim() ? ' with a new description' : ' and its description is cleared'}.`
					: 'Give the DAO its new name below.';
			case 'dissolve':
				return 'The DAO is dissolved once every other vote has settled. Its record stays readable; nothing new can be proposed.';
			default:
				return 'The decision is recorded on the ledger. Nothing else changes.';
		}
	});
	/** A title the proposal can carry if none is typed. */
	const suggested = $derived.by(() => {
		switch (kind) {
			case 'shares':
				return 'Change the shares';
			case 'info':
				return newName.trim() ? `Rename to ${newName.trim()}` : 'Rename the DAO';
			case 'dissolve':
				return 'Dissolve the DAO';
			default:
				return '';
		}
	});

	// One signature, from the member's own contract; the vote opens as it lands.
	const f = remote.createProposalForm;
	let title = $state('');
	const enhanced = signedForm(
		f,
		schema,
		(fields, { pid, membership, dao: daoCid, closesAt }) => {
			const action: Plain =
				fields.kind === 'shares'
					? {
							tag: 'SetShares',
							value: {
								shares: parsed(fields.shares).map((r) => ({ _1: r.party, _2: r.share.toFixed(10) }))
							}
						}
					: fields.kind === 'info'
						? {
								tag: 'SetInfo',
								value: { daoName: fields.newName.trim(), description: fields.newDescription }
							}
						: fields.kind === 'dissolve'
							? { tag: 'Dissolve', value: {} }
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
		description="Every member votes with their share. You choose what passing takes; the ledger counts by that rule, and what the proposal does when it passes, the ledger does."
	/>

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !store.who}
		<ConnectPrompt what="propose" />
	{:else if dao?.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else}
		<form {...enhanced} class="space-y-8">
			<input {...f.fields.dao.as('hidden', id)} />
			<input type="hidden" name="kind" value={kind} />
			<input type="hidden" name="title" value={title.trim() || suggested} />

			<FormSection title="What happens when it passes">
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
							<span>
								<span class="block font-display text-[15px] font-bold">{k.title}</span>
								<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{k.text}</span>
							</span>
						</label>
					{/each}
				</div>

				{#if kind === 'shares'}
					<Field
						label="The table after"
						id="shares"
						hint="Today's holders and shares to start from. Add, remove, move; it must add up to 100."
						issues={f.fields.shares.issues()}
					>
						{#if seeded}
							<ShareTable name="shares" dao={id} busy={store.busy} bind:rows />
						{:else}
							<Skeleton height="h-24" />
						{/if}
					</Field>
				{:else if kind === 'info'}
					<Field label="New name" id="newName" issues={f.fields.newName.issues()}>
						<Input
							{...f.fields.newName.as('text')}
							id="newName"
							maxlength={60}
							placeholder={dao?.current?.name ?? ''}
							bind:value={newName}
						/>
					</Field>
					<Field
						label="New description"
						id="newDescription"
						issues={f.fields.newDescription.issues()}
					>
						<Textarea
							{...f.fields.newDescription.as('text')}
							id="newDescription"
							rows={4}
							maxlength={2000}
							placeholder={dao?.current?.description || 'Leave empty to clear it'}
							bind:value={newDescription}
						/>
					</Field>
				{/if}

				<Note mono={false}>
					<span class="font-mono text-[0.6875rem] tracking-[0.14em] text-ink-dim uppercase"
						>If it passes</span
					>
					<span class="mt-1 block">{outcome}</span>
				</Note>
			</FormSection>

			<FormSection title="How it passes">
				{#key ruleFor}<RulePicker bind:rule />{/key}
			</FormSection>

			<FormSection title="Put it to the vote">
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
					<Textarea
						{...f.fields.description.as('text')}
						id="description"
						rows={5}
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

			{#if dao?.ready}
				<p class="font-mono text-xs text-ink-dim">
					The vote opens for the {fmt(dao.current.members)} current holders the moment you sign.
				</p>
			{:else}
				<Skeleton height="h-4" />
			{/if}

			<FormActions
				label="Create proposal"
				busy={store.busy || f.pending > 0}
				disabled={!dao?.ready ||
					(kind === 'shares' && (!whole || changes.joins + changes.leaves + changes.moved === 0)) ||
					(kind === 'info' && newName.trim().length < 2)}
				cancelHref="/daos/{id}"
				problem={store.problem}
			/>
		</form>
	{/if}
</Page>
