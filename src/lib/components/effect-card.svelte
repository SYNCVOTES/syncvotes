<script lang="ts">
	import Panel from './panel.svelte';
	import PartyId from './party-id.svelte';
	import Markdown from './markdown.svelte';
	import LoadMore from './load-more.svelte';
	import SearchInput from './search-input.svelte';
	import { fmt } from '$lib/format';
	import type { Settings } from '$lib/rules';
	import SettingsSummary from './settings-summary.svelte';

	/**
	 * What a proposal does when it passes, spelled out — for a share change, who joins, who
	 * leaves, who gains and who loses, against the table of today.
	 */
	export type Effect =
		| { kind: 'signal' }
		| { kind: 'choose'; options: string[]; several: boolean }
		| { kind: 'shares'; changes: { party: string; share: number }[] }
		| { kind: 'info'; name: string; description: string; image: string | null }
		| { kind: 'dissolve' }
		| { kind: 'visibility'; public: boolean }
		| { kind: 'settings'; routine: Settings; sensitive: Settings };
	let {
		effect,
		executed,
		executedAt,
		equal = false,
		current
	}: {
		effect: Effect;
		executed: number;
		executedAt: string | null;
		/** The DAO votes by membership: units are people. */
		equal?: boolean;
		current: { party: string; share: number }[];
	} = $props();
	const title = $derived.by(() => {
		switch (effect.kind) {
			case 'shares':
				return equal ? 'Membership' : 'Shares of the vote';
			case 'choose':
				return 'Choice';
			case 'info':
				return 'Name and description';
			case 'dissolve':
				return 'Dissolution';
			case 'visibility':
				return 'Visibility';
			case 'settings':
				return 'Voting rules';
			default:
				return 'Decision';
		}
	});
	const now = $derived(new Map(current.map((m) => [m.party, m.share])));
	let shown = $state(30);
	let q = $state('');
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
	const found = $derived(
		q ? rows.filter((r) => r.party.toLowerCase().includes(q.toLowerCase())) : rows
	);
</script>

<Panel padding="sm" class="space-y-3">
	<h2 class="eyebrow">
		{title}{executedAt
			? ' · executed'
			: executed > 0
				? ` · ${fmt(executed)} of ${fmt(rows.length)} executed`
				: ''}
	</h2>
	{#if effect.kind === 'shares'}
		{#if rows.length > 30}
			<SearchInput bind:value={q} placeholder="Search by party ID" />
		{/if}
		<ul class="divide-y divide-border">
			{#each found.slice(0, shown) as d (d.party)}
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
			shown={Math.min(shown, found.length)}
			total={found.length}
			noun="entries"
			all={2000}
			onmore={(n) => (shown = n)}
		/>
		{#if executedAt}<p class="font-mono text-xs text-ink-dim">Current membership.</p>{/if}
	{:else if effect.kind === 'info'}
		<!-- What the proposal sets, field by field; it does not claim a rename when the name stays. -->
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
			<dt class="font-mono text-xs text-ink-dim">Name</dt>
			<dd class="font-display font-bold text-ink">{effect.name}</dd>
			<dt class="font-mono text-xs text-ink-dim">Picture</dt>
			<dd class="text-ink-mid">
				{#if effect.image}<img
						referrerpolicy="no-referrer"
						src={effect.image}
						alt=""
						class="h-32 w-full border border-border object-cover"
					/>{:else}None{/if}
			</dd>
			<dt class="font-mono text-xs text-ink-dim">Description</dt>
			<dd class="min-w-0 text-ink-mid">
				{#if effect.description}<Markdown text={effect.description} />{:else}Cleared{/if}
			</dd>
		</dl>
	{:else if effect.kind === 'dissolve'}
		<p class="text-body-sm text-ink-mid">
			Closes the DAO permanently, once every other open proposal is decided. The remaining balance
			is lost.
		</p>
	{:else if effect.kind === 'choose'}
		<p class="text-body-sm text-ink-mid">
			{effect.several ? 'Options (pick any):' : 'Options:'}
		</p>
		<ol class="list-decimal space-y-1 pl-5 text-body-sm text-ink">
			{#each effect.options as o, i (i)}<li>{o}</li>{/each}
		</ol>
	{:else if effect.kind === 'visibility'}
		<p class="text-body-sm text-ink-mid">
			{effect.public ? 'Makes the DAO public.' : 'Makes the DAO private.'}
		</p>
	{:else if effect.kind === 'settings'}
		<p class="text-body-sm text-ink-mid">From then on:</p>
		<SettingsSummary sensitive={effect.sensitive} />
	{:else}
		<p class="text-body-sm text-ink-mid">Records a decision only.</p>
	{/if}
</Panel>
