<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Label } from '$lib/components/ui/label';

	/** A label, the control, and a hint under it. The control is whatever is passed in. */
	let {
		label,
		id,
		hint,
		children
	}: { label: string; id: string; hint?: string; children: Snippet } = $props();
</script>

<div class="space-y-2">
	<Label for={id}>{label}</Label>
	{@render children()}
	{#if hint}<p class="text-xs text-ink-dim">{hint}</p>{/if}
</div>
