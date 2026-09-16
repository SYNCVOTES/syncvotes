<script lang="ts">
	import type { Snippet } from 'svelte';
	import Panel from './panel.svelte';

	/** A short remark on a surface: what happened, or why nothing can. */
	let { mono = true, children }: { mono?: boolean; children: Snippet } = $props();
</script>

<Panel padding="sm" class={mono ? 'font-mono text-xs text-ink-mid' : 'text-[13px] text-ink-dim'}>
	{@render children()}
</Panel>
