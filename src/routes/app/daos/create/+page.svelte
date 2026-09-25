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
	import Problem from '$lib/components/problem.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		CATEGORIES,
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
	import { fmt, coin } from '$lib/format';

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
			more: "Only members and the app's validator receive its data."
		},
		{
			value: 'public',
			title: 'Public',
			text: 'Anyone signed in can read it. Only members act.',
			more: 'Listed on Public DAOs. Readers can also top up its balance. Say in the description how to join. Change later with a Visibility proposal.'
		}
	] as const;
	const payers = [
		{
			value: 'dao',
			title: 'The DAO pays',
			text: 'One shared balance that anyone can top up.',
			more: 'When the balance is empty, nobody can act in the DAO until someone tops it up.'
		},
		{
			value: 'members',
			title: 'Each member pays',
			text: 'Each member pays for their own actions from their Wallet balance.',
			more: 'The proposer also pays for counting and executing their proposal.'
		}
	] as const;
	const modes = [
		{
			value: 'equal',
			title: 'By membership',
			text: 'One member, one vote. A club, a committee, a collective.',
			more: 'Each member holds one vote. Members join and leave by vote.',
			icon: Users
		},
		{
			value: 'shares',
			title: 'By shares',
			text: 'Members hold units of the vote (40 of 100, for example). A company, a fund, a partnership.',
			more: "Voting power is units over the total. Units change only by vote; topping up the balance doesn't change them.",
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
	let daoName = $state('');
	// Creating the DAO is charged to the creator: their balance sits next to the button.
	const purse = $derived(store.who ? remote.myPurse(store.who.party) : null);
	const covers = CATEGORIES.find((c) => c.value === 'sensitive')!.covers;
	let image = $state('');
	// The rule everything that changes the DAO passes by, starting from the founding default. A
	// decision or a choice runs under a rule its proposer sets, so the DAO's routine settings go
	// along unchanged, as the founding default a proposer's form starts from.
	const routine = copySettings(DEFAULTS.routine);
	let sensitive = $state<Settings>(copySettings(DEFAULTS.sensitive));
	/** "2/3 of the whole vote · 14 days": the rule in a line, for the summary. */
	const ruleLine = $derived.by(() => {
		const r = sensitive.rule;
		const t = r.threshold;
		const amount =
			t.kind === 'majority'
				? 'Majority'
				: t.kind === 'percent'
					? `${t.percent}%`
					: `${t.num}/${t.den}`;
		return `${amount} ${r.basis === 'all' ? 'of the whole vote' : 'of votes cast'}${r.quorum ? ` · ${r.quorum}% quorum` : ''} · ${sensitive.votingDays} ${sensitive.votingDays === 1 ? 'day' : 'days'}`;
	});

	// The intent is the founding table as the ledger reads it: the first batch of rows, and the
	// rest as a proposal already passed. The server orders the creator first; so does this.
	const enhanced = signedForm(
		f,
		schema,
		(fields, { id, args: sent }) => {
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
					rules: settingsToLedger(settingsOf(fields, 'sensitive')),
					decisions: settingsToLedger(settingsOf(fields, 'routine')),
					shares: shareTuples(ordered.slice(0, BATCH)),
					more: shareTuples(ordered.slice(BATCH)),
					// The provider's featured app right, which only the server knows; a marker on it
					// records the app's activity and changes nothing of the DAO.
					featuredAppRight: sent.featuredAppRight
				}
			};
		},
		({ id }) => goto(`/app/daos/${id}`)
	);
</script>

<svelte:head><title>Create DAO — SyncVotes</title></svelte:head>

<Page width="wide">
	<PageHeader eyebrow="New DAO" title="Create DAO" />

	{#if store.screen.at === 'loading'}
		<Skeleton height="h-64" />
	{:else if !store.who}
		<ConnectPrompt what="create a DAO" />
	{:else}
		<form {...enhanced} class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
			<input type="hidden" name="equal" value={mode === 'equal' ? 'yes' : 'no'} />
			<input type="hidden" name="actorPays" value={payer === 'members' ? 'yes' : 'no'} />
			<input type="hidden" name="public" value={visibility === 'public' ? 'yes' : 'no'} />

			<div class="min-w-0 space-y-10">
				<FormSection variant="plain" number="01" title="Basics">
					<Field label="Name" id="daoName" issues={f.fields.daoName.issues()}>
						<Input
							{...f.fields.daoName.as('text')}
							id="daoName"
							placeholder="Canton Technical Committee"
							maxlength={60}
							oninput={(e) => (daoName = (e.currentTarget as HTMLInputElement).value)}
						/>
					</Field>
					<Field label="Description" id="description" issues={f.fields.description.issues()}>
						<MarkdownEditor
							name="description"
							id="description"
							bind:value={description}
							maxlength={10_000}
							placeholder="What this DAO is for. Markdown supported."
							disabled={store.busy}
						/>
					</Field>
					<Field label="Picture" id="image" issues={f.fields.image.issues()}>
						<ImageField name="image" id="image" bind:value={image} disabled={store.busy} />
					</Field>
				</FormSection>

				<FormSection variant="plain" number="02" title="How it votes" fixed>
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
									<span class="flex items-center gap-1.5 font-display text-body font-bold"
										>{m.title}
										<Hint text={m.more} align={m.value === 'shares' ? 'end' : 'start'} /></span
									>
									<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{m.text}</span>
								</span>
							</label>
						{/each}
					</div>
				</FormSection>

				<FormSection variant="plain" number="03" title="Who can see it">
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
									<span class="flex items-center gap-1.5 font-display text-body font-bold"
										>{o.title}
										<Hint text={o.more} align={o.value === 'public' ? 'end' : 'start'} /></span
									>
									<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{o.text}</span>
								</span>
							</label>
						{/each}
					</div>
				</FormSection>

				<FormSection variant="plain" number="04" title="Who pays" fixed>
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
									<span class="flex items-center gap-1.5 font-display text-body font-bold"
										>{p.title}
										<Hint text={p.more} align={p.value === 'members' ? 'end' : 'start'} /></span
									>
									<span class="mt-1 block text-xs leading-relaxed text-ink-mid">{p.text}</span>
								</span>
							</label>
						{/each}
					</div>
					<Note>Creating the DAO is charged to you.</Note>
				</FormSection>

				<FormSection variant="plain" number="05" title="Voting rules" hint={covers}>
					<p class="text-body-sm leading-relaxed text-ink-mid">
						Apply to changes to the DAO itself. Decisions and choices use a rule their proposer
						sets.
					</p>
					{#each settingsFields('routine', routine) as [name, value] (name)}
						<input type="hidden" {name} {value} />
					{/each}
					<RuleSettings
						bind:settings={sensitive}
						prefix="sensitive"
						eligible={summary.units}
						equal={mode === 'equal'}
						collapsed
					>
						{#snippet ballot()}
							<RuleSettings
								bind:settings={sensitive}
								prefix="sensitive"
								part="ballot"
								bare
								eligible={summary.units}
								equal={mode === 'equal'}
							/>
						{/snippet}
					</RuleSettings>
				</FormSection>

				<FormSection variant="plain" number="06" title={mode === 'equal' ? 'Members' : 'Shares'}>
					<Field
						label={mode === 'equal' ? 'Members' : 'Members and their units'}
						id="shares"
						hint={mode === 'equal'
							? 'You and the other founding members.'
							: 'You and the other founding members. Units are whole numbers.'}
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
						<Note>
							The first {fmt(BATCH)} join at once; the other {fmt(summary.members - BATCH)} are added
							in batches right after.
						</Note>
					{/if}
				</FormSection>

				<Problem message={store.problem} />
			</div>

			<!-- What is about to be signed and the button that signs it: beside the form on a wide
			     screen, a bar along the bottom on a phone. -->
			<aside class="lg:sticky lg:top-24 lg:self-start">
				<div class="hidden space-y-4 border border-border bg-surface p-5 md:p-6 lg:block">
					<h2 class="eyebrow">Summary</h2>
					<p class="title text-xl">{daoName.trim() || 'Unnamed DAO'}</p>
					<ul class="space-y-1.5 font-mono text-xs text-ink-mid">
						<li>
							{mode === 'equal' ? 'By membership' : 'By shares'} · {visibility === 'public'
								? 'Public'
								: 'Private'}
						</li>
						<li>{payer === 'dao' ? 'The DAO pays' : 'Each member pays'}</li>
						<li>Changes pass: {ruleLine}</li>
						<li>
							{fmt(summary.members)} founding {summary.members === 1
								? 'member'
								: 'members'}{mode === 'shares' ? `, ${fmt(summary.units)} units` : ''}
						</li>
					</ul>
					<p class="border-t border-border pt-3 font-mono text-xs text-ink-dim">
						{#if purse?.ready && purse.current.free}Free on this network.{:else}Charged to your
							balance{#if purse?.ready}: <span
									class={purse.current.balance > 0 ? 'text-ink' : 'text-red'}
									>{coin(purse.current.balance)}</span
								>{/if}.{/if}
					</p>
					<FormActions
						label="Create DAO"
						busy={store.busy || f.pending > 0}
						disabled={!summary.valid || !validRule(sensitive.rule)}
						cancelHref="/app/my-daos"
					/>
				</div>
				<div
					class="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-border bg-[rgba(var(--bg-rgb),0.95)] px-6 py-3 backdrop-blur md:-mx-10 md:px-10 lg:hidden"
				>
					<span class="min-w-0 truncate font-mono text-xs text-ink-dim"
						>{mode === 'equal' ? 'By membership' : 'By shares'} · {visibility === 'public'
							? 'Public'
							: 'Private'} · {fmt(summary.members)}
						{summary.members === 1 ? 'member' : 'members'}</span
					>
					<Button
						type="submit"
						class="shrink-0"
						disabled={store.busy || f.pending > 0 || !summary.valid || !validRule(sensitive.rule)}
						>{store.busy || f.pending > 0 ? 'Signing…' : 'Create DAO'}</Button
					>
				</div>
			</aside>
		</form>
	{/if}
</Page>
