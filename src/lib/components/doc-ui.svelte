<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * What the docs point at, set apart from the prose the same way everywhere: a `control` (a
	 * button, field, tab or badge) looks like the app's own mono label, a `term` is a word the
	 * docs define, a `message` is text the app shows, quoted.
	 */
	let { kind = 'control', children }: { kind?: 'control' | 'term' | 'message'; children: Snippet } =
		$props();
</script>

{#if kind === 'message'}<q class="doc-message">{@render children()}</q>{:else}<span
		class={kind === 'term' ? 'doc-term' : 'doc-control'}>{@render children()}</span
	>{/if}
