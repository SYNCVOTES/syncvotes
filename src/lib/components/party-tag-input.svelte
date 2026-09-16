<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { Input } from '$lib/components/ui/input';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import Loader from '@lucide/svelte/icons/loader';

	/**
	 * Members as chips, the way v1 did it: paste or type names or party addresses, separated by
	 * spaces or commas; each becomes a chip and is checked against the registry as it lands.
	 * `value` is the party ids of the chips that checked out; `status` says whether the form may
	 * go ahead. The admin is never a chip — they are in by construction.
	 */
	type Chip = {
		token: string;
		status: 'checking' | 'valid' | 'invalid';
		party?: string;
		name?: string;
	};

	let {
		value = $bindable([]),
		status = $bindable({ valid: true, checking: false }),
		exclude,
		placeholder = 'Paste or type names or party addresses, separated by spaces or commas',
		disabled = false
	}: {
		value?: string[];
		status?: { valid: boolean; checking: boolean };
		exclude?: string;
		placeholder?: string;
		disabled?: boolean;
	} = $props();

	let chips = $state<Chip[]>([]);
	let text = $state('');
	let duplicate = $state<string | null>(null);
	let seeded = $state(false);

	// Chips for what the form starts with (an existing DAO's members), once.
	$effect(() => {
		if (seeded || value.length === 0) return;
		seeded = true;
		for (const party of value) add(party);
	});

	$effect(() => {
		value = chips.filter((c) => c.status === 'valid').map((c) => c.party!);
		status = {
			valid: chips.every((c) => c.status !== 'invalid'),
			checking: chips.some((c) => c.status === 'checking')
		};
	});

	const split = (raw: string) =>
		raw
			.split(/[\s,]+/)
			.map((t) => t.trim())
			.filter(Boolean);

	async function add(token: string) {
		const t = token.includes('::') ? token : token.toLowerCase();
		if (t === exclude || chips.some((c) => c.token === t || c.party === t)) {
			duplicate = t;
			setTimeout(() => (duplicate = null), 1200);
			return;
		}
		const chip: Chip = { token: t, status: 'checking' };
		chips = [...chips, chip];
		const found = await remote.member(t).catch(() => null);
		chips = chips.map((c) =>
			c !== chip
				? c
				: found && found.party !== exclude
					? { ...c, status: 'valid', party: found.party, name: found.name }
					: { ...c, status: 'invalid' }
		);
	}

	function commit() {
		const raw = text;
		text = '';
		for (const token of split(raw)) void add(token);
	}

	const remove = (chip: Chip) => (chips = chips.filter((c) => c !== chip));

	const short = (party: string) => `${party.split('::')[1]?.slice(0, 6) ?? ''}…`;
</script>

<div class="space-y-2">
	{#if chips.length > 0}
		<ul class="flex flex-wrap gap-2">
			{#each chips as chip (chip.token)}
				<li
					class="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs {chip.status ===
					'invalid'
						? 'border-red/40 bg-red/10 text-red'
						: chip.status === 'checking'
							? 'border-border text-ink-dim'
							: 'border-orange/40 bg-orange/10 text-orange'} {duplicate === chip.token
						? 'animate-pulse-soft'
						: ''}"
					title={chip.party ?? chip.token}
				>
					{#if chip.status === 'checking'}<Loader size={12} class="animate-spin" />
					{:else if chip.status === 'valid'}<Check size={12} />
					{:else}<X size={12} />{/if}
					<span class="truncate">{chip.name ?? chip.token}</span>
					{#if chip.party}<span class="text-ink-dim">{short(chip.party)}</span>{/if}
					{#if chip.status === 'invalid'}<span class="text-red/70">not registered</span>{/if}
					<button
						type="button"
						class="ml-0.5 hover:text-ink"
						aria-label="Remove {chip.name ?? chip.token}"
						onclick={() => remove(chip)}
						{disabled}><X size={12} /></button
					>
				</li>
			{/each}
		</ul>
	{/if}
	<Input
		{placeholder}
		{disabled}
		autocomplete="off"
		bind:value={text}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
				if (!text.trim() && e.key !== 'Tab') return;
				if (e.key !== 'Tab') e.preventDefault();
				commit();
			} else if (e.key === 'Backspace' && !text && chips.length) {
				remove(chips[chips.length - 1]);
			}
		}}
		onblur={commit}
		onpaste={(e) => {
			const pasted = e.clipboardData?.getData('text') ?? '';
			if (split(pasted).length > 1) {
				e.preventDefault();
				for (const token of split(pasted)) void add(token);
			}
		}}
	/>
</div>
