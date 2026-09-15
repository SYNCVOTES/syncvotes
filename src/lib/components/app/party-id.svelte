<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';

	/**
	 * A party id, shortened, with the full one a click away. Everywhere a party appears it can
	 * be copied — that is how people add each other and check who signed what.
	 */
	let { party, class: className = '' }: { party: string; class?: string } = $props();

	const short = $derived(`${party.split('::')[0]}::${party.split('::')[1]?.slice(0, 8) ?? ''}…`);
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

<span class="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-ink-dim {className}">
	<span class="truncate" title={party}>{short}</span>
	<button
		type="button"
		class="shrink-0 transition-colors hover:text-orange {copied ? 'text-green' : ''}"
		aria-label={copied ? 'Copied' : 'Copy party id'}
		title={copied ? 'Copied' : 'Copy party id'}
		onclick={copy}
	>
		{#if copied}<Check size={13} />{:else}<Copy size={13} />{/if}
	</button>
</span>
