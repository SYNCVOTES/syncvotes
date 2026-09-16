<script lang="ts">
	import * as remote from '$lib/api.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import PartyId from './party-id.svelte';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import Loader from '@lucide/svelte/icons/loader';
	import { fmt } from '$lib/format';

	/**
	 * Members to add, as chips. Type or paste party ids — one, or a thousand at once — separated
	 * by spaces, commas or newlines; every chip checks itself against the registry and the DAO
	 * in one call and says so. Past a few dozen the chips fold into a summary, and the button
	 * says how many will be added.
	 */
	let {
		dao,
		busy = false,
		onadd
	}: { dao: string; busy?: boolean; onadd: (parties: string[]) => Promise<boolean> } = $props();

	type Status = 'checking' | Awaited<ReturnType<typeof remote.checkMembers>>[string];
	let tokens = $state<string[]>([]);
	let status = $state<Record<string, Status>>({});
	let text = $state('');
	let expanded = $state(false);

	const FOLD = 40;
	const split = (raw: string) =>
		raw
			.split(/[\s,]+/)
			.map((t) => t.trim())
			.filter((t) => t.includes('::'));
	const by = (s: Status) => tokens.filter((t) => status[t] === s);
	const ready = $derived(by('addable'));
	const shown = $derived(expanded || tokens.length <= FOLD ? tokens : tokens.slice(0, FOLD));

	let pending: string[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;

	function add(raw: string) {
		const fresh = split(raw).filter((t) => !tokens.includes(t));
		if (fresh.length === 0) return;
		tokens = [...tokens, ...fresh];
		for (const t of fresh) status[t] = 'checking';
		pending.push(...fresh);
		clearTimeout(timer);
		timer = setTimeout(check, 150);
	}

	// A query travels in the URL, so a pasted thousand is checked forty ids at a time.
	const CHUNK = 40;
	function check() {
		const batch = pending.splice(0);
		for (let i = 0; i < batch.length; i += CHUNK) {
			const chunk = batch.slice(i, i + CHUNK);
			remote.checkMembers({ dao, parties: chunk }).then(
				(checked) => Object.assign(status, checked),
				() => chunk.forEach((t) => (status[t] = 'unknown'))
			);
		}
	}

	const remove = (t: string) => {
		tokens = tokens.filter((x) => x !== t);
		delete status[t];
	};
	const clear = (s: Status) => (tokens = tokens.filter((t) => status[t] !== s));

	const look: Record<Status, string> = {
		checking: 'border-border text-ink-dim',
		addable: 'border-orange/40 bg-orange/10 text-orange',
		unknown: 'border-red/40 bg-red/10 text-red',
		already: 'border-border bg-surface-hover text-ink-dim'
	};
	const note: Record<Status, string> = {
		checking: '',
		addable: '',
		unknown: 'not registered',
		already: 'already a member'
	};
</script>

<div class="space-y-3">
	<Input
		placeholder="Party ids — type one, or paste a whole list"
		autocomplete="off"
		class="font-mono text-xs"
		bind:value={text}
		disabled={busy}
		onkeydown={(e) => {
			if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && text.trim()) {
				e.preventDefault();
				add(text);
				text = '';
			} else if (e.key === 'Backspace' && !text && tokens.length) remove(tokens[tokens.length - 1]);
		}}
		onpaste={(e) => {
			const pasted = e.clipboardData?.getData('text') ?? '';
			if (split(pasted).length > 0) {
				e.preventDefault();
				add(pasted);
			}
		}}
		onblur={() => {
			if (text.trim()) {
				add(text);
				text = '';
			}
		}}
	/>

	{#if tokens.length > 0}
		<ul class="flex flex-wrap gap-2">
			{#each shown as t (t)}
				<li
					class="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs {look[
						status[t]
					]}"
					title={t}
				>
					{#if status[t] === 'checking'}<Loader size={12} class="animate-spin" />
					{:else if status[t] === 'addable'}<Check size={12} />
					{:else}<X size={12} />{/if}
					<PartyId party={t} class="[&_button]:hidden [&>span>span:first-child]:text-current" />
					{#if note[status[t]]}<span class="opacity-70">{note[status[t]]}</span>{/if}
					<button
						type="button"
						class="ml-0.5 hover:text-ink"
						aria-label="Remove {t}"
						onclick={() => remove(t)}
						disabled={busy}><X size={12} /></button
					>
				</li>
			{/each}
			{#if tokens.length > FOLD && !expanded}
				<li>
					<button
						type="button"
						class="rounded-full border border-border px-3 py-1 font-mono text-xs text-ink-mid hover:text-ink"
						onclick={() => (expanded = true)}
					>
						+{fmt(tokens.length - FOLD)} more
					</button>
				</li>
			{/if}
		</ul>
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-dim">
			<span class="text-green">{fmt(ready.length)} to add</span>
			{#if by('unknown').length}<span class="text-red"
					>{fmt(by('unknown').length)} not registered</span
				><button type="button" class="underline hover:text-ink" onclick={() => clear('unknown')}
					>drop them</button
				>{/if}
			{#if by('already').length}<span>{fmt(by('already').length)} already members</span><button
					type="button"
					class="underline hover:text-ink"
					onclick={() => clear('already')}>drop them</button
				>{/if}
			{#if by('checking').length}<span>checking {fmt(by('checking').length)}…</span>{/if}
		</div>
	{/if}

	<Button
		disabled={busy || ready.length === 0 || by('checking').length > 0}
		onclick={async () => {
			if (await onadd(ready)) {
				tokens = tokens.filter((t) => status[t] !== 'addable');
			}
		}}
	>
		{ready.length === 0
			? 'Add members'
			: `Add ${fmt(ready.length)} ${ready.length === 1 ? 'member' : 'members'}`}
	</Button>
</div>
