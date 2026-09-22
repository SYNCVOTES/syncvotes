<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import { store } from '$lib/wallet-store.svelte';
	import { signedForm } from '$lib/forms';
	import { createProposalForm as schema, shareChanges, BATCH } from '$lib/schemas';
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
	import PartyChips from '$lib/components/party-chips.svelte';
	import Note from '$lib/components/note.svelte';
	import RulePicker from '$lib/components/rule-picker.svelte';
	import { PRESETS, toLedger, type Rule } from '$lib/rules';
	import PieChart from '@lucide/svelte/icons/pie-chart';
	import Users from '@lucide/svelte/icons/users';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Power from '@lucide/svelte/icons/power';
	import Coins from '@lucide/svelte/icons/coins';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { fmt, coin } from '$lib/format';
	import * as v from 'valibot';

	const id = $derived(page.params.id!);
	const dao = $derived(store.who ? remote.dao(id) : null);
	const d = $derived(dao?.current ?? null);
	const billing = $derived(store.who ? remote.daoBilling(id) : null);

	/**
	 * A proposal is what happens when it passes, first; the words come after. The kind is picked
	 * up top, its own fields follow — filled in with what is there today, so a change starts
	 * from the truth — and before signing the page says in one sentence what the ledger will
	 * do: the same sentence the voters will read.
	 */
	type Kind = 'signal' | 'shares' | 'info' | 'payout' | 'dissolve';
	let kind = $state<Kind>('signal');
	const kinds = $derived([
		{
			value: 'signal',
			title: 'Decision',
			text: 'The DAO takes a position. Nothing else changes.',
			icon: MessageSquare
		},
		d?.equal
			? {
					value: 'shares',
					title: 'Members',
					text: 'Who is in the DAO: parties join or leave.',
					icon: Users
				}
			: {
					value: 'shares',
					title: 'Shares',
					text: 'Who holds what share of the vote: parties join, leave, gain or lose.',
					icon: PieChart
				},
		{
			value: 'info',
			title: 'Name & description',
			text: 'A new name, description or picture.',
			icon: Pencil
		},
		{ value: 'payout', title: 'Payout', text: 'Coin from the treasury to a party.', icon: Coins },
		{ value: 'dissolve', title: 'Dissolve', text: 'The DAO is wound up for good.', icon: Power }
	] as const);

	// What is there today, to start from.
	let newName = $state('');
	let newDescription = $state('');
	let newImage = $state('');
	let remainderTo = $state<string[]>([]);
	let seeded = $state(false);
	$effect(() => {
		if (!d || seeded) return;
		seeded = true;
		newName = d.name;
		newDescription = d.description;
		newImage = d.image ?? '';
		remainderTo = [d.creator];
	});
	let payoutTo = $state<string[]>([]);
	let payoutAmount = $state<number | undefined>(undefined);
	let payoutReason = $state('');

	let rule = $state<Rule>({ ...PRESETS[0].rule! });
	// A dissolution or a payout starts out unanimous / two thirds; anything else, a majority of
	// all. The author decides.
	let ruleFor = $state<Kind>('signal');
	$effect(() => {
		if (kind === ruleFor) return;
		ruleFor = kind;
		const preset = kind === 'dissolve' ? 'unanimous' : kind === 'payout' ? 'twoThirds' : 'majority';
		const fallback = PRESETS.find((p) => p.value === preset)!.rule!;
		rule = { ...fallback, threshold: { ...fallback.threshold } };
	});

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
	const holdings = $derived(billing?.current?.holdings ?? null);

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
			case 'payout':
				if (!payoutTo[0] || !payoutAmount) return 'Say who is paid, and how much.';
				return `${coin(payoutAmount)} leaves the treasury for ${payoutTo[0].split('::')[0]} the moment this passes${holdings !== null && payoutAmount > holdings ? ' — more than the treasury holds today; it waits until it can be paid' : ''}.`;
			case 'dissolve':
				return `The DAO is dissolved once every other vote has settled; whatever the treasury holds goes to ${remainderTo[0]?.split('::')[0] ?? 'the party named below'}. Its record stays readable; nothing new can be proposed.`;
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
			case 'payout':
				return payoutAmount
					? `Pay ${coin(payoutAmount)}${payoutTo[0] ? ` to ${payoutTo[0].split('::')[0]}` : ''}`
					: 'Payout';
			case 'dissolve':
				return 'Dissolve the DAO';
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
								changes: v
									.parse(shareChanges, fields.shares)
									.map((r) => ({ _1: r.party, _2: String(r.share) }))
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
						: fields.kind === 'payout'
							? {
									tag: 'Payout',
									value: {
										to: fields.payoutTo.trim(),
										amount: fields.payoutAmount.toFixed(10),
										reason: fields.payoutReason
									}
								}
							: fields.kind === 'dissolve'
								? { tag: 'Dissolve', value: { remainderTo: fields.remainderTo.trim() } }
								: { tag: 'Signal', value: {} };
			const rule: Rule = {
				basis: fields.basis,
				threshold:
					fields.threshold === 'percent'
						? { kind: 'percent', percent: fields.percent }
						: { kind: 'majority' },
				quorum: fields.quorum,
				early: fields.early === 'yes',
				changeable: fields.changeable === 'yes'
			};
			return {
				choice: 'Member_Propose',
				contractId: membership,
				args: {
					dao: args.dao,
					pid,
					title: fields.title,
					description: fields.description,
					closesAt: args.closesAt,
					action,
					rule: toLedger(rule)
				}
			};
		},
		({ pid }) => goto(`/proposals/${pid}`)
	);

	// A week is the usual voting period; the field starts there.
	$effect(() => {
		if (f.fields.days.value() === undefined) f.fields.days.set(7);
	});
	const ready = $derived.by(() => {
		if (!d) return false;
		switch (kind) {
			case 'shares':
				return summary.valid;
			case 'info':
				return newName.trim().length >= 2 && infoChanged;
			case 'payout':
				return !!payoutTo[0] && !!payoutAmount && payoutAmount > 0;
			case 'dissolve':
				return !!remainderTo[0];
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
		description="Every member votes with their share. You choose what passing takes; the ledger counts by that rule, and what the proposal does when it passes, the ledger does."
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
			<input type="hidden" name="payoutTo" value={payoutTo[0] ?? ''} />
			<input type="hidden" name="remainderTo" value={remainderTo[0] ?? ''} />

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
				{:else if kind === 'payout'}
					<Field
						label="Paid to"
						id="payoutTo"
						hint="Any party on the network; a member or not. Coin lands directly where the party accepts transfers, otherwise it waits for them to accept."
						issues={f.fields.payoutTo.issues()}
					>
						<PartyChips busy={store.busy} placeholder="Party id" bind:parties={payoutTo} />
					</Field>
					<Field
						label="Amount, CC"
						id="payoutAmount"
						hint={holdings !== null ? `The treasury holds ${coin(holdings)} today.` : undefined}
						issues={f.fields.payoutAmount.issues()}
					>
						<Input
							{...f.fields.payoutAmount.as('number')}
							id="payoutAmount"
							min={0.0001}
							step="0.0001"
							class="w-48"
							bind:value={payoutAmount}
						/>
					</Field>
					<Field label="For" id="payoutReason" issues={f.fields.payoutReason.issues()}>
						<Input
							{...f.fields.payoutReason.as('text')}
							id="payoutReason"
							maxlength={500}
							placeholder="Hosting for Q4"
							bind:value={payoutReason}
						/>
					</Field>
				{:else if kind === 'dissolve'}
					<Field
						label="What is left goes to"
						id="remainderTo"
						hint="Whatever the treasury holds when the DAO dissolves is sent here."
						issues={f.fields.remainderTo.issues()}
					>
						<PartyChips busy={store.busy} placeholder="Party id" bind:parties={remainderTo} />
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
					<MarkdownEditor
						name="description"
						id="description"
						bind:value={description}
						maxlength={20_000}
						placeholder="What is being decided, and why. Markdown; pictures by link."
						disabled={store.busy}
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
