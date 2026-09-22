<script lang="ts">
	/* eslint-disable no-useless-assignment -- `checking` is bound out and written by an effect */
	import * as remote from '$lib/api.remote';
	import { Input } from '$lib/components/ui/input';
	import PartyId from './party-id.svelte';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import Loader from '@lucide/svelte/icons/loader';
	import { fmt } from '$lib/format';

	/**
	 * Party ids as chips. Type or paste — one, or a thousand at once — separated by spaces,
	 * commas or newlines; every chip checks itself against the registry (and, given a DAO,
	 * its membership) in one call and says so. Past a few dozen the chips fold into a summary.
	 * `parties` is the list that passed; with `name`, it travels in the form as a hidden field.
	 */
	let {
		dao,
		name,
		busy = false,
		placeholder = 'Party ids — type one, or paste a whole list',
		parties = $bindable([]),
		checking = $bindable(false)
	}: {
		dao?: string;
		name?: string;
		busy?: boolean;
		placeholder?: string;
		parties?: string[];
		checking?: boolean;
	} = $props();

	type Status = 'checking' | remote.PartyCheck;
	// Parties handed in at the start (a field filled with what is there today) are chips already.
	let tokens = $state<string[]>([...parties]);
	let status = $state<Record<string, Status>>(
		Object.fromEntries(parties.map((p) => [p, 'addable' as Status]))
	);
	let text = $state('');
	let expanded = $state(false);

	const FOLD = 40;
	const split = (raw: string) =>
		raw
			.split(/[\s,]+/)
			.map((t) => t.trim())
			.filter((t) => t.includes('::'));
	const by = (s: Status) => tokens.filter((t) => status[t] === s);
	const shown = $derived(expanded || tokens.length <= FOLD ? tokens : tokens.slice(0, FOLD));
	$effect(() => {
		parties = by('addable');
		checking = by('checking').length > 0;
	});

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
			remote.checkParties({ dao, parties: chunk }).then(
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

	/** Drops the chips that were taken care of, after a successful submit. */
	export const settle = () => (tokens = tokens.filter((t) => status[t] !== 'addable'));

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
	{#if name}<input type="hidden" {name} value={parties.join(' ')} />{/if}
	<Input
		{placeholder}
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
			<span class="text-green">{fmt(parties.length)} ready</span>
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
</div>
