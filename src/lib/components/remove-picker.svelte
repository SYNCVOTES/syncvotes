<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { Input } from '$lib/components/ui/input';
	import PartyId from './party-id.svelte';
	import X from '@lucide/svelte/icons/x';
	import { fmt } from '$lib/format';

	/**
	 * Members of a DAO, picked as chips: type to filter the members list, click to pick. For
	 * naming who leaves, or who is to be admin. `parties` travels in the form under `name`.
	 */
	let {
		dao,
		name,
		busy = false,
		parties = $bindable([])
	}: { dao: string; name?: string; busy?: boolean; parties?: string[] } = $props();

	let q = $state('');
	const found = $derived(q.trim() ? remote.daoMembers({ id: dao, offset: 0, limit: 8, q }) : null);
	const pick = (p: string) => {
		if (!parties.includes(p)) parties = [...parties, p];
		q = '';
	};
	const drop = (p: string) => (parties = parties.filter((x) => x !== p));
</script>

<div class="space-y-3">
	{#if name}<input type="hidden" {name} value={parties.join(' ')} />{/if}
	<div class="relative">
		<Input
			placeholder="Type part of a member's party id"
			autocomplete="off"
			class="font-mono text-xs"
			bind:value={q}
			disabled={busy}
		/>
		{#if found?.ready && found.current.items.length > 0}
			<ul
				class="absolute z-10 mt-1 max-h-64 w-full overflow-auto border border-border bg-surface shadow-lg"
			>
				{#each found.current.items as m (m.party)}
					<li>
						<button
							type="button"
							class="flex w-full items-center px-3 py-2 text-left font-mono text-xs hover:bg-surface-hover disabled:opacity-40"
							disabled={parties.includes(m.party)}
							onclick={() => pick(m.party)}
						>
							<PartyId party={m.party} class="[&_button]:hidden" />
						</button>
					</li>
				{/each}
				{#if found.current.total > found.current.items.length}
					<li class="px-3 py-2 font-mono text-xs text-ink-dim">
						{fmt(found.current.total - found.current.items.length)} more — keep typing
					</li>
				{/if}
			</ul>
		{/if}
	</div>
	{#if parties.length > 0}
		<ul class="flex flex-wrap gap-2">
			{#each parties as p (p)}
				<li
					class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-orange/40 bg-orange/10 px-3 py-1 font-mono text-xs text-orange"
					title={p}
				>
					<PartyId party={p} class="[&_button]:hidden [&>span>span:first-child]:text-current" />
					<button
						type="button"
						class="ml-0.5 hover:text-ink"
						aria-label="Remove {p}"
						onclick={() => drop(p)}
						disabled={busy}><X size={12} /></button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
