<script lang="ts">
	import type { Snippet } from 'svelte';

	/** An eyebrow over a value. */
	let {
		label,
		class: className = '',
		children
	}: { label: string; class?: string; children: Snippet } = $props();
</script>

<div class={className}>
	<div class="eyebrow mb-1">{label}</div>
	{@render children()}
</div>
