<script lang="ts">
	import type { Snippet } from 'svelte';
	import Panel from './panel.svelte';

	/** A group of fields with an eyebrow. */
	let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<Panel class="space-y-5">
	{#if title}<h2 class="eyebrow">{title}</h2>{/if}
	{@render children()}
</Panel>
