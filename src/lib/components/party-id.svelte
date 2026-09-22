<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import { hintOf } from '$lib/format';

	/**
	 * A party, as it is named everywhere: the hint it chose, the two colons, and enough of its
	 * fingerprint to tell it from another party with the same hint — the id's own shape, cut
	 * short — with the full id a click away. Copying is how people add each other and check who
	 * signed what.
	 */
	let {
		party,
		size = 'sm',
		class: className = ''
	}: { party: string; size?: 'sm' | 'md'; class?: string } = $props();

	const short = $derived(party.split('::')[1]?.slice(0, 8) ?? '');
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(party);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// The page is not allowed to write the clipboard here; the title still shows the id.
		}
	}
</script>

<span
	class="inline-flex min-w-0 items-center gap-1.5 font-mono {size === 'md'
		? 'text-sm'
		: 'text-xs'} {className}"
	title={party}
>
	<span class="truncate">
		<span class="text-ink">{hintOf(party)}</span><span class="text-ink-dim">::{short}…</span>
	</span>
	<button
		type="button"
		class="shrink-0 text-ink-dim transition-colors hover:text-orange {copied ? 'text-green' : ''}"
		aria-label={copied ? 'Copied' : 'Copy party id'}
		title={copied ? 'Copied' : 'Copy party id'}
		onclick={copy}
	>
		{#if copied}<Check size={13} />{:else}<Copy size={13} />{/if}
	</button>
</span>
