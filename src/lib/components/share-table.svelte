<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import PartyChips from './party-chips.svelte';
	import PartyId from './party-id.svelte';
	import X from '@lucide/svelte/icons/x';

	/**
	 * Who holds what share of the vote, as a table that must add up to a hundred: a row per
	 * party with a percent and a bar, parties added by chips, a button to split evenly, and the
	 * remainder shown until it is gone. The rows travel in the form under `name`, one
	 * `party=percent` per line, so what is signed is what the table showed.
	 */
	export type Row = { party: string; share: number };
	let {
		rows = $bindable([]),
		name,
		dao,
		busy = false,
		fixed = []
	}: {
		rows?: Row[];
		name?: string;
		dao?: string;
		busy?: boolean;
		/** Parties that cannot be removed from the table (the creator at the founding). */
		fixed?: string[];
	} = $props();

	let added = $state<string[]>([]);
	let checking = $state(false);
	$effect(() => {
		for (const p of added)
			if (!rows.some((r) => r.party === p)) rows = [...rows, { party: p, share: 0 }];
	});

	const round = (n: number) => Math.round(n * 100) / 100;
	const total = $derived(round(rows.reduce((s, r) => s + r.share, 0)));
	const left = $derived(round(100 - total));
	const whole = $derived(
		rows.length > 0 && Math.abs(left) < 0.005 && rows.every((r) => r.share > 0)
	);

	/** An even split, to the cent, the first rows taking what does not divide. */
	function split() {
		const n = rows.length;
		if (!n) return;
		const base = Math.floor(10000 / n);
		let rest = 10000 - base * n;
		rows = rows.map((r) => ({ ...r, share: (base + (rest-- > 0 ? 1 : 0)) / 100 }));
	}
	const set = (party: string, value: string) =>
		(rows = rows.map((r) => (r.party === party ? { ...r, share: round(Number(value) || 0) } : r)));
	const drop = (party: string) => {
		rows = rows.filter((r) => r.party !== party);
		added = added.filter((p) => p !== party);
	};
</script>

{#if name}<input
		type="hidden"
		{name}
		value={rows.map((r) => `${r.party}=${r.share.toFixed(2)}`).join('\n')}
	/>{/if}

<div class="space-y-3">
	{#if rows.length > 0}
		<div class="flex h-2 overflow-hidden bg-surface-active">
			{#each rows as r (r.party)}
				<div
					class="bg-orange odd:opacity-70"
					style="width: {Math.max(0, r.share)}%"
					title="{r.party}: {r.share}%"
				></div>
			{/each}
		</div>
		<ul class="divide-y divide-border border border-border">
			{#each rows as r (r.party)}
				<li class="flex items-center gap-3 px-3 py-2">
					<PartyId party={r.party} class="min-w-0 flex-1" />
					<Input
						type="number"
						min={0}
						max={100}
						step="0.01"
						class="w-24 text-right"
						value={r.share}
						disabled={busy}
						aria-label="Share of {r.party}"
						oninput={(e) => set(r.party, (e.currentTarget as HTMLInputElement).value)}
					/>
					<span class="w-4 font-mono text-xs text-ink-dim">%</span>
					{#if !fixed.includes(r.party)}
						<button
							type="button"
							class="text-ink-dim hover:text-red"
							aria-label="Remove {r.party}"
							onclick={() => drop(r.party)}
							disabled={busy}
						>
							<X size={14} />
						</button>
					{:else}
						<span class="w-[14px]"></span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<PartyChips
		{dao}
		{busy}
		placeholder="Add a party by id — one, or a whole list"
		bind:parties={added}
		bind:checking
	/>
	<div class="flex flex-wrap items-center gap-3 font-mono text-xs">
		<Button
			type="button"
			variant="outline"
			size="sm"
			onclick={split}
			disabled={busy || rows.length === 0}>Split equally</Button
		>
		<span class={whole ? 'text-green' : 'text-red'}>
			{total.toFixed(2)}% of 100{whole
				? ''
				: left > 0
					? ` — ${left.toFixed(2)}% left to hand out`
					: left < 0
						? ` — ${(-left).toFixed(2)}% too much`
						: ' — every share must be above zero'}
		</span>
		{#if checking}<span class="text-ink-dim">checking…</span>{/if}
	</div>
</div>
