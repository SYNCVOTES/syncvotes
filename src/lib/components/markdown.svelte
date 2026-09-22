<script lang="ts">
	import { render } from '$lib/markdown';

	/** Markdown text as a block of the page. Empty text shows the fallback, muted. */
	let {
		text,
		fallback = '',
		class: className = ''
	}: { text: string; fallback?: string; class?: string } = $props();
	// Rendered in the browser only: the cleaner needs a DOM.
	let html = $derived(render(text));
</script>

{#if text.trim()}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- cleaned by DOMPurify in render() -->
	<div class="markdown {className}">{@html html}</div>
{:else if fallback}
	<p class="text-sm text-ink-dim {className}">{fallback}</p>
{/if}
