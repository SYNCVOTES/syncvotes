<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A caveat in the docs, set apart from the text: a label and one or two sentences. `warn`
	 * for what cannot be undone, `operator` for what only whoever runs the app can change.
	 */
	let {
		title = 'Note',
		tone = 'info',
		children
	}: { title?: string; tone?: 'info' | 'warn' | 'operator'; children: Snippet } = $props();
	const tones = {
		info: 'border-l-orange',
		warn: 'border-l-amber',
		operator: 'border-l-ink-dim'
	};
</script>

<aside
	class="my-6 border border-l-2 border-border bg-surface px-4 py-3 text-body-sm leading-relaxed text-ink-mid {tones[
		tone
	]} [&_p]:my-1.5"
>
	<p class="!mt-0 font-mono text-label tracking-[0.14em] text-ink-dim uppercase">{title}</p>
	{@render children()}
</aside>
