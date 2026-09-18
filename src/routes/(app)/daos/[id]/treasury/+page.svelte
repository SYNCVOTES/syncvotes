<script lang="ts">
	import { page } from '$app/state';
	import * as remote from '$lib/api.remote';
	import * as actions from '$lib/actions';
	import { store, flow, describe } from '$lib/wallet-store.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Page from '$lib/components/page.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import QueryError from '$lib/components/query-error.svelte';
	import ConnectPrompt from '$lib/components/connect-prompt.svelte';
	import Problem from '$lib/components/problem.svelte';
	import PartyId from '$lib/components/party-id.svelte';
	import Panel from '$lib/components/panel.svelte';
	import Note from '$lib/components/note.svelte';
	import Skeleton from '$lib/components/skeleton.svelte';
	import List from '$lib/components/list.svelte';
	import ListItem from '$lib/components/list-item.svelte';
	import DangerZone from '$lib/components/danger-zone.svelte';
	import SigningSession from '$lib/components/signing-session.svelte';
	import { coin, fmt, relative } from '$lib/format';

	const id = $derived(page.params.id!);
	const me = $derived(store.who?.party ?? null);
	const dao = $derived(me ? remote.dao(id) : null);
	const treasury = $derived(me ? remote.daoTreasury(id) : null);
	type TreasuryView = Awaited<ReturnType<typeof remote.daoTreasury>>;
	type Intent = Parameters<typeof remote.treasuryOpen>[0]['intent'];

	let threshold = $state(1);
	let moveTo = $state('');
	let moveAmount = $state(0);

	const problem = (e: unknown) => (store.problem = describe(e));
	const begin = () => remote.treasuryBegin({ dao: id, threshold }).catch(problem);
	const open = (intent: Intent) => remote.treasuryOpen({ dao: id, intent }).catch(problem);
	const signSetup = (admins: string[], t: number, plan: NonNullable<TreasuryView['plan']>) =>
		flow.act((s, w) => actions.signTreasurySetup(s, w, id, admins, t, plan));
	const record = (expected: { party: string; signers: string[]; threshold: number }) =>
		flow.act((s, w) => actions.recordTreasury(s, w, id, expected));
	const drop = () => flow.act((s, w) => actions.dropTreasury(s, w, id));
</script>

<svelte:head><title>Treasury — {dao?.current?.name ?? 'DAO'} — SyncVotes</title></svelte:head>

<Page back={{ href: `/daos/${id}`, label: dao?.current?.name ?? 'DAO' }}>
	{#if !dao || !treasury}
		<ConnectPrompt what="see the treasury" />
	{:else if dao.error}
		<QueryError error={dao.error} refresh={() => dao?.reconnect()} />
	{:else if treasury.error}
		<QueryError error={treasury.error} refresh={() => treasury?.reconnect()} />
	{:else if !dao.ready || !treasury.ready}
		<Skeleton />
	{:else}
		{@const d = dao.current}
		{@const t = treasury.current}
		{@const signer = !!me && (t.treasury?.signers.includes(me) ?? d.admins.includes(me))}
		<PageHeader
			eyebrow="Treasury"
			title="Treasury"
			description="A party of the DAO's own, owned by its admins' keys: nobody else can move its coin, and a threshold of them sign every payout together, live, within the two minutes the network gives a signed transaction. Anyone can send it coin; it pays out what proposals decide."
		/>

		<Problem message={store.problem} />

		{#if t.treasury}
			<Panel class="space-y-4">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<div class="font-mono text-3xl font-bold">{coin(t.balance)}</div>
						<p class="mt-1 font-mono text-xs text-ink-dim">
							{t.treasury.threshold} of {t.treasury.signers.length} signers · {t.approved
								? 'accepts coin from anyone'
								: 'not yet open to deposits'}
						</p>
					</div>
					<PartyId party={t.treasury.party} size="md" />
				</div>
				<div class="flex flex-wrap items-center gap-2 font-mono text-xs text-ink-dim">
					Signers:
					{#each t.treasury.signers as s (s)}<PartyId party={s} />{/each}
				</div>
				{#if t.stale}
					<Note mono={false}
						>The admins changed since this treasury was built. Its signers can still move the coin —
						to a new treasury, once one is built, or elsewhere — and an admin can then let it go.</Note
					>
				{/if}
				{#if !t.approved && signer}
					<Button size="sm" disabled={store.busy} onclick={() => open({ kind: 'approve' })}
						>Open to deposits ({t.treasury.threshold} signatures)</Button
					>
				{/if}
			</Panel>

			<section class="mt-8 space-y-3">
				<h2 class="eyebrow">Payouts due</h2>
				{#if t.due.length === 0}
					<p class="text-[13px] text-ink-dim">Nothing decided is waiting to be paid.</p>
				{:else}
					<List>
						{#each t.due as due (due.contractId)}
							{@const busy = t.sessions.some(
								(s) => !s.done && s.intent.kind === 'payout' && s.intent.due === due.contractId
							)}
							<ListItem class="flex flex-wrap items-center gap-3 font-mono text-xs">
								<span class="text-ink">{coin(due.amount)}</span>
								<span class="text-ink-dim">to</span>
								<PartyId party={due.to} />
								<span class="text-ink-dim">decided {relative(due.createdAt)}</span>
								<a href="/proposals/{due.proposalId}" class="text-orange underline">proposal</a>
								{#if signer}
									<Button
										size="sm"
										class="ml-auto"
										disabled={store.busy || busy}
										onclick={() => open({ kind: 'payout', due: due.contractId })}>Pay</Button
									>
								{/if}
							</ListItem>
						{/each}
					</List>
				{/if}
			</section>

			{#if t.sessions.length > 0}
				<section class="mt-8 space-y-3">
					<h2 class="eyebrow">Signing</h2>
					{#each t.sessions as s (s.id)}
						<SigningSession session={s} treasury={t.treasury.party} {signer} />
					{/each}
				</section>
			{/if}

			{#if signer}
				<section class="mt-8">
					<Panel padding="sm" class="space-y-3">
						<h2 class="eyebrow">Move coin</h2>
						<p class="text-[13px] text-ink-dim">
							Outside a proposal: for a treasury being replaced, or a mistake. {t.treasury
								.threshold} signatures, like a payout.
						</p>
						<div class="flex flex-wrap gap-2">
							<Input
								placeholder="To party id"
								class="min-w-64 flex-1 font-mono text-xs"
								bind:value={moveTo}
							/>
							<Input
								type="number"
								step="any"
								min={0}
								placeholder="CC"
								class="w-32"
								bind:value={moveAmount}
							/>
							<Button
								size="sm"
								variant="outline"
								disabled={store.busy || !moveTo.includes('::') || !(moveAmount > 0)}
								onclick={() => open({ kind: 'move', to: moveTo, amount: moveAmount })}>Move</Button
							>
						</div>
					</Panel>
				</section>
			{/if}

			{#if d.me.admin && t.stale}
				<div class="mt-8">
					<DangerZone
						title="Let go of this treasury"
						text="Removes it from the DAO. Move its coin out first: its signers are the only ones who ever can."
						action="Let go"
						confirm="Yes, let go"
						busy={store.busy}
						onconfirm={drop}
					/>
				</div>
			{/if}
		{:else if t.setup}
			{@const s = t.setup}
			{@const owners = [...s.signed, ...s.pending]}
			<Panel class="space-y-4">
				<h2 class="eyebrow">Building the treasury</h2>
				<p class="text-[13px] text-ink-mid">
					Every admin signs the treasury's identity: the party
					<span class="font-mono text-ink">{s.party.split('::')[0]}</span>, owned by their {owners.length}
					keys, {s.threshold} of which sign a payout. Each browser checks the identity is exactly that
					before signing.
				</p>
				<div class="grid gap-2 sm:grid-cols-2">
					{#each owners as p (p)}
						{@const done = s.signed.includes(p)}
						<div class="flex items-center gap-2 font-mono text-xs">
							<span class={done ? 'text-green' : 'text-ink-dim'}>{done ? '✓' : '·'}</span>
							<PartyId party={p} />
							{#if !done && p === me && t.plan}
								{@const plan = t.plan}
								<Button
									size="sm"
									class="ml-auto"
									disabled={store.busy}
									onclick={() => signSetup(d.admins, s.threshold, plan)}>Sign</Button
								>
							{/if}
						</div>
					{/each}
				</div>
				{#if s.problem}<p class="text-[13px] text-red">{s.problem}</p>{/if}
				{#if s.allocated}
					<Note mono={false}>
						The party exists on the network. {#if s.approved}It accepts deposits.{:else}Next, {s.threshold}
							admin{s.threshold === 1 ? '' : 's'} sign to open it to deposits — live, together.{/if}
					</Note>
					{#if !s.approved && signer && s.proposal}
						<Button size="sm" disabled={store.busy} onclick={() => open({ kind: 'approve' })}
							>Open to deposits</Button
						>
					{/if}
					{#each t.sessions as sess (sess.id)}
						<SigningSession session={sess} treasury={s.party} {signer} />
					{/each}
					{#if d.me.admin}
						<div class="border-t border-border pt-4">
							<p class="mb-2 text-[13px] text-ink-mid">
								Last, record it on the DAO: one admin's signature.
							</p>
							<Button
								disabled={store.busy}
								onclick={() => record({ party: s.party, signers: owners, threshold: s.threshold })}
								>Record the treasury</Button
							>
						</div>
					{/if}
				{/if}
				{#if d.me.admin && !s.allocated}
					<Button variant="ghost" size="sm" disabled={store.busy} onclick={begin}>Start over</Button
					>
				{/if}
			</Panel>
		{:else if d.me.admin}
			<Panel class="space-y-4">
				<h2 class="eyebrow">Build a treasury</h2>
				<p class="text-[13px] text-ink-mid">
					The treasury will be owned by the {fmt(d.admins.length)} admin{d.admins.length === 1
						? ''
						: 's'} of this moment. Choose how many of them a payout needs; then every admin signs once.
				</p>
				<div class="flex items-center gap-3">
					<label class="font-mono text-xs text-ink-dim" for="threshold">Signatures per payout</label
					>
					<Input
						id="threshold"
						type="number"
						min={1}
						max={d.admins.length}
						class="w-24"
						bind:value={threshold}
					/>
					<span class="font-mono text-xs text-ink-dim">of {d.admins.length}</span>
				</div>
				<Button
					disabled={store.busy || threshold < 1 || threshold > d.admins.length}
					onclick={begin}>Begin</Button
				>
			</Panel>
		{:else}
			<Note mono={false}>This DAO has no treasury. An admin can build one.</Note>
		{/if}
	{/if}
</Page>
