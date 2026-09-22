<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import PartyChips from './party-chips.svelte';
	import Who from './who.svelte';
	import X from '@lucide/svelte/icons/x';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Search from '@lucide/svelte/icons/search';
	import { fmt } from '$lib/format';

	/**
	 * Who is in the DAO and, where the vote is by shares, with how many units — one editor for
	 * the founding table and for every change proposed later, so the two read the same. Built
	 * for thousands: the list is windowed, filtered by name or id, fed by pasted ids or a whole
	 * `party units` list, and the form only carries what changed (`emit: 'diff'`) or, at the
	 * founding, everything. A removed member stays in view at zero until the change is signed,
	 * so a slip is undone in place.
	 */
	export type Person = { party: string; name: string | null; avatar: string | null };
	export type Row = { party: string; share: number; who?: Person | null };
	export type Summary = {
		members: number;
		units: number;
		joins: number;
		leaves: number;
		moved: number;
		changes: number;
		valid: boolean;
	};

	let {
		mode,
		rows = $bindable([]),
		baseline = [],
		emit = 'all',
		name,
		dao,
		busy = false,
		fixed = [],
		summary = $bindable<Summary>({
			members: 0,
			units: 0,
			joins: 0,
			leaves: 0,
			moved: 0,
			changes: 0,
			valid: false
		})
	}: {
		/** By membership (one unit each) or by shares (any number of units). */
		mode: 'equal' | 'shares';
		rows?: Row[];
		/** Today's table; empty at the founding. */
		baseline?: Row[];
		/** What travels in the form: every row, or only what differs from the baseline. */
		emit?: 'all' | 'diff';
		name?: string;
		dao?: string;
		busy?: boolean;
		/** Parties that cannot be removed (the creator at the founding). */
		fixed?: string[];
		summary?: Summary;
	} = $props();

	const before = $derived(new Map(baseline.map((r) => [r.party, r.share])));
	const unitsOf = (r: Row) => (mode === 'equal' ? (r.share > 0 ? 1 : 0) : r.share);

	// ---- what changed, and what the form carries ---------------------------------------------

	const lines = $derived.by(() => {
		const out: string[] = [];
		for (const r of rows) {
			const units = unitsOf(r);
			if (emit === 'all') {
				if (units > 0) out.push(`${r.party}=${units}`);
			} else if ((before.get(r.party) ?? 0) !== units) out.push(`${r.party}=${units}`);
		}
		return out.join('\n');
	});

	$effect(() => {
		let members = 0;
		let units = 0;
		let joins = 0;
		let leaves = 0;
		let moved = 0;
		for (const r of rows) {
			const u = unitsOf(r);
			const had = before.get(r.party) ?? 0;
			if (u > 0) {
				members++;
				units += u;
			}
			if (had === 0 && u > 0) joins++;
			else if (had > 0 && u === 0) leaves++;
			else if (had !== u) moved++;
		}
		const changes = joins + leaves + moved;
		summary = {
			members,
			units,
			joins,
			leaves,
			moved,
			changes,
			valid:
				members > 0 &&
				units > 0 &&
				(emit === 'all' || changes > 0) &&
				rows.every((r) => Number.isInteger(r.share) && r.share >= 0)
		};
	});

	// ---- adding ------------------------------------------------------------------------------

	let added = $state<string[]>([]);
	let checking = $state(false);
	$effect(() => {
		const fresh = added.filter((p) => !rows.some((r) => r.party === p));
		if (fresh.length) rows = [...rows, ...fresh.map((party) => ({ party, share: 1 }))];
	});

	let importing = $state(false);
	let pasted = $state('');
	let importNote = $state('');
	/** `party units`, `party,units`, `party=units` or `party` per line; units default to one. */
	async function importList() {
		const parsed = pasted
			.split(/\n+/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((l) => {
				const [party, units] = l.split(/[\s,=;]+/);
				return { party, share: Math.max(0, Math.floor(Number(units)) || 1) };
			})
			.filter((r) => r.party?.includes('::'));
		if (parsed.length === 0) {
			importNote = 'No party ids found.';
			return;
		}
		checking = true;
		importNote = `Checking ${fmt(parsed.length)}…`;
		const unknown: string[] = [];
		try {
			for (let i = 0; i < parsed.length; i += 100) {
				const chunk = parsed.slice(i, i + 100).map((r) => r.party);
				const found = await remote.checkParties({ dao, parties: chunk });
				for (const p of chunk) if (found[p] === 'unknown') unknown.push(p);
			}
		} catch {
			importNote = 'Could not check the list; try again.';
			checking = false;
			return;
		}
		checking = false;
		const ok = parsed.filter((r) => !unknown.includes(r.party));
		const taken = new Map(ok.map((r) => [r.party, mode === 'equal' ? 1 : r.share]));
		rows = [
			...rows.map((r) => (taken.has(r.party) ? { ...r, share: taken.get(r.party)! } : r)),
			...ok
				.filter((r) => !rows.some((x) => x.party === r.party))
				.map((r) => ({ party: r.party, share: taken.get(r.party)! }))
		];
		importNote = `${fmt(ok.length)} taken${unknown.length ? `, ${fmt(unknown.length)} not registered and left out` : ''}.`;
		pasted = unknown.join('\n');
	}

	// ---- editing -----------------------------------------------------------------------------

	const set = (party: string, value: string) => {
		const n = Math.max(0, Math.floor(Number(value) || 0));
		rows = rows.map((r) => (r.party === party ? { ...r, share: n } : r));
	};
	function remove(party: string) {
		if (before.has(party) && emit === 'diff') set(party, '0');
		else {
			rows = rows.filter((r) => r.party !== party);
			added = added.filter((p) => p !== party);
		}
	}
	const restore = (party: string) => set(party, String(before.get(party) ?? 1));
	const equalise = () => (rows = rows.map((r) => (r.share > 0 ? { ...r, share: 1 } : r)));

	// ---- the list, windowed -----------------------------------------------------------------

	let q = $state('');
	const shown = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const list = needle
			? rows.filter(
					(r) =>
						r.party.toLowerCase().includes(needle) ||
						(r.who?.name?.toLowerCase().includes(needle) ?? false)
				)
			: rows;
		// New parties first, so what was just added is in view; then by units, then by id.
		return [...list].sort((a, b) => {
			const na = before.has(a.party) ? 1 : 0;
			const nb = before.has(b.party) ? 1 : 0;
			return na - nb || b.share - a.share || a.party.localeCompare(b.party);
		});
	});
	const ROW = 52;
	const VIEW = 440;
	let scrollTop = $state(0);
	const first = $derived(Math.max(0, Math.floor(scrollTop / ROW) - 3));
	const last = $derived(Math.min(shown.length, Math.ceil((scrollTop + VIEW) / ROW) + 3));
	const window_ = $derived(shown.slice(first, last));

	const pct = (r: Row) =>
		summary.units > 0 ? ((unitsOf(r) / summary.units) * 100).toFixed(2) : '0.00';
	const status = (r: Row): 'joins' | 'leaves' | 'changed' | null => {
		if (emit === 'all') return null;
		const had = before.get(r.party) ?? 0;
		const u = unitsOf(r);
		if (had === 0 && u > 0) return 'joins';
		if (had > 0 && u === 0) return 'leaves';
		if (had !== u) return 'changed';
		return null;
	};
</script>

{#if name}<input type="hidden" {name} value={lines} />{/if}

<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-2">
		<label class="relative block min-w-[12rem] flex-1">
			<Search
				size={14}
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-dim"
				aria-hidden="true"
			/>
			<Input
				class="pl-9"
				placeholder="Find by name or id"
				bind:value={q}
				aria-label="Find a member"
			/>
		</label>
		{#if mode === 'shares'}
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={equalise}
				disabled={busy || rows.length === 0}>One unit each</Button
			>
		{/if}
		<Button
			type="button"
			variant={importing ? 'default' : 'outline'}
			size="sm"
			onclick={() => (importing = !importing)}
			disabled={busy}>Paste a list</Button
		>
	</div>

	{#if importing}
		<div class="space-y-2 border border-border p-3">
			<Textarea
				rows={5}
				class="font-mono text-xs"
				placeholder={mode === 'shares'
					? 'One per line: party id, then units — e.g.\nalice::1220…  40\nbob::1220…  25'
					: 'One party id per line'}
				bind:value={pasted}
			/>
			<div class="flex flex-wrap items-center gap-3">
				<Button
					type="button"
					size="sm"
					onclick={importList}
					disabled={busy || checking || !pasted.trim()}>Take the list</Button
				>
				<span class="font-mono text-xs text-ink-dim">{importNote}</span>
			</div>
		</div>
	{:else}
		<PartyChips
			{dao}
			{busy}
			placeholder="Add a party by id — one, or a whole list"
			bind:parties={added}
			bind:checking
		/>
	{/if}

	{#if rows.length > 0}
		<div
			class="overflow-y-auto border border-border"
			style="max-height: {VIEW}px"
			onscroll={(e) => (scrollTop = (e.currentTarget as HTMLElement).scrollTop)}
		>
			<div class="relative" style="height: {shown.length * ROW}px">
				{#each window_ as r, i (r.party)}
					{@const s = status(r)}
					{@const gone = unitsOf(r) === 0}
					<div
						class="absolute right-0 left-0 flex items-center gap-3 border-b border-border px-3 {gone
							? 'opacity-60'
							: ''}"
						style="top: {(first + i) * ROW}px; height: {ROW}px"
					>
						<Who
							who={r.who ?? { party: r.party, name: null, avatar: null }}
							class="min-w-0 flex-1 {gone ? 'line-through' : ''}"
						/>
						{#if s}
							<span
								class="hidden font-mono text-[0.6875rem] tracking-[0.14em] uppercase sm:inline {s ===
								'leaves'
									? 'text-red'
									: s === 'joins'
										? 'text-green'
										: 'text-amber'}">{s}</span
							>
						{/if}
						{#if mode === 'shares' && !gone}
							<Input
								type="number"
								min={0}
								step="1"
								class="w-24 text-right"
								value={r.share}
								disabled={busy}
								aria-label="Units of {r.party}"
								oninput={(e) => set(r.party, (e.currentTarget as HTMLInputElement).value)}
							/>
						{/if}
						<span class="w-16 text-right font-mono text-xs text-ink-dim"
							>{gone ? '' : `${pct(r)}%`}</span
						>
						{#if gone}
							<button
								type="button"
								class="text-ink-dim hover:text-ink"
								aria-label="Keep {r.party}"
								title="Keep"
								onclick={() => restore(r.party)}
								disabled={busy}><Undo size={14} /></button
							>
						{:else if !fixed.includes(r.party)}
							<button
								type="button"
								class="text-ink-dim hover:text-red"
								aria-label="Remove {r.party}"
								title="Remove"
								onclick={() => remove(r.party)}
								disabled={busy}><X size={14} /></button
							>
						{:else}
							<span class="w-[14px]"></span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
		<span class={summary.valid ? 'text-ink' : 'text-red'}>
			{fmt(summary.members)}
			{summary.members === 1 ? 'member' : 'members'}{mode === 'shares'
				? `, ${fmt(summary.units)} units`
				: ''}
		</span>
		{#if emit === 'diff'}
			<span class="text-ink-dim">
				{#if summary.changes === 0}nothing changes yet{:else}
					{#if summary.joins}<span class="text-green">+{fmt(summary.joins)}</span>{/if}
					{#if summary.leaves}<span class="text-red">−{fmt(summary.leaves)}</span>{/if}
					{#if summary.moved}<span class="text-amber">{fmt(summary.moved)} reshared</span>{/if}
				{/if}
			</span>
		{/if}
		{#if q && shown.length !== rows.length}<span class="text-ink-dim"
				>{fmt(shown.length)} shown</span
			>{/if}
		{#if checking}<span class="text-ink-dim">checking…</span>{/if}
	</div>
</div>
