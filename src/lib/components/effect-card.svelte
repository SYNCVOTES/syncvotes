<script lang="ts">
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';
	import Markdown from './markdown.svelte';
	import LoadMore from './load-more.svelte';
	import { coin, fmt } from '$lib/format';
	import type { Settings } from '$lib/rules';
	import SettingsSummary from './settings-summary.svelte';

	/**
	 * What a proposal does when it passes, spelled out — for a share change, who joins, who
	 * leaves, who gains and who loses, against the table of today; for a payout, who gets what.
	 */
	export type Effect =
		| { kind: 'signal' }
		| { kind: 'shares'; changes: { party: string; share: number }[] }
		| { kind: 'info'; name: string; description: string; image: string | null }
		| { kind: 'payout'; to: string; amount: number; reason: string }
		| { kind: 'dissolve'; remainderTo: string }
		| { kind: 'settings'; routine: Settings; sensitive: Settings };
	let {
		effect,
		executed,
		executedAt,
		equal = false,
		current,
		paid = null,
		awaiting = false
	}: {
		effect: Effect;
		executed: number;
		executedAt: string | null;
		/** The DAO votes by membership: units are people. */
		equal?: boolean;
		current: { party: string; share: number }[];
		/** The transaction that paid a payout or the remainder, once it went out. */
		paid?: string | null;
		/** The payout went out and waits for the receiver to accept it. */
		awaiting?: boolean;
	} = $props();
	const title = $derived.by(() => {
		switch (effect.kind) {
			case 'shares':
				return equal ? 'Membership' : 'Shares of the vote';
			case 'info':
				return 'Name and description';
			case 'payout':
				return 'Payout';
			case 'dissolve':
				return 'Dissolution';
			case 'settings':
				return 'Settings';
			default:
				return 'Decision';
		}
	});
	const now = $derived(new Map(current.map((m) => [m.party, m.share])));
	let shown = $state(30);
	const rows = $derived(
		effect.kind === 'shares'
			? effect.changes.map((c, i) => ({
					party: c.party,
					to: c.share,
					from: executedAt ? null : (now.get(c.party) ?? 0),
					done: i < executed
				}))
			: []
	);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">
		{title}{executedAt
			? ' · carried out'
			: executed > 0
				? ` · ${fmt(executed)} of ${fmt(rows.length)} carried out`
				: ''}
	</h2>
	{#if effect.kind === 'shares'}
		<ul class="divide-y divide-border">
			{#each rows.slice(0, shown) as d (d.party)}
				<li class="flex items-center gap-3 py-1.5 font-mono text-xs">
					<PartyId party={d.party} class="min-w-0 flex-1" />
					{#if d.to === 0}
						<span class="text-red">leaves</span>
					{:else if d.from === null}
						<span class="text-ink-mid">{equal ? 'member' : `${fmt(d.to)} units`}</span>
					{:else if d.from === 0}
						<span class="text-green">joins{equal ? '' : ` with ${fmt(d.to)} units`}</span>
					{:else if d.from !== d.to}
						<span class="text-ink-dim">{fmt(d.from)}</span><span class="text-ink-dim">→</span><span
							class={d.to > d.from ? 'text-green' : 'text-red'}>{fmt(d.to)} units</span
						>
					{:else}
						<span class="text-ink-dim">{fmt(d.to)} units, as now</span>
					{/if}
					{#if d.done && !executedAt}<span class="text-ink-dim">done</span>{/if}
				</li>
			{/each}
		</ul>
		<LoadMore
			shown={Math.min(shown, rows.length)}
			total={rows.length}
			noun="entries"
			onmore={() => (shown += 100)}
		/>
		{#if executedAt}<p class="font-mono text-xs text-ink-dim">This is the table now.</p>{/if}
	{:else if effect.kind === 'info'}
		<div class="space-y-2 text-[13px] text-ink-mid">
			<p>
				Renames the DAO to <span class="font-display font-bold text-ink">{effect.name}</span
				>{effect.image ? ', with a new picture' : ''}{effect.description
					? ' and describes it as:'
					: ' and clears its description.'}
			</p>
			{#if effect.image}<img
					src={effect.image}
					alt=""
					class="h-32 w-full border border-border object-cover"
				/>{/if}
			{#if effect.description}<Markdown text={effect.description} />{/if}
		</div>
	{:else if effect.kind === 'payout'}
		<div class="space-y-2 text-[13px] text-ink-mid">
			<p class="flex flex-wrap items-center gap-x-2">
				Pays <span class="font-mono font-bold text-ink">{coin(effect.amount)}</span> from the
				treasury to <PartyId party={effect.to} class="align-middle" />
			</p>
			{#if effect.reason}<Markdown text={effect.reason} />{/if}
			{#if awaiting}
				<p class="font-mono text-xs text-amber">
					Sent; waiting for the receiver to accept it (a SyncVotes member does so on their Wallet
					page). Unaccepted, it returns to the treasury.
				</p>
			{:else if paid || executedAt}<p class="font-mono text-xs text-green">Paid.</p>{/if}
		</div>
	{:else if effect.kind === 'dissolve'}
		<p class="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-mid">
			Dissolves the DAO once every other vote has settled; whatever the treasury holds goes to
			<PartyId party={effect.remainderTo} class="align-middle" />. Its settled proposals stay
			readable; nothing new can be proposed.
		</p>
	{:else if effect.kind === 'settings'}
		<p class="text-[13px] text-ink-mid">From then on:</p>
		<SettingsSummary routine={effect.routine} sensitive={effect.sensitive} />
	{:else}
		<p class="text-[13px] text-ink-mid">Decides, and does nothing else.</p>
	{/if}
</Panel>
