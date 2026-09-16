<script lang="ts">
	import type { Snippet } from 'svelte';
	import { reveal } from './landing-classes';
	import { cn } from '$lib/utils.js';

	/** A section headline in Syne caps that rises into view. */
	let { class: className = '', children }: { class?: string; children: Snippet } = $props();
</script>

<h2
	class={cn(
		'font-display text-[clamp(36px,4vw,60px)] leading-[1.04] font-extrabold tracking-[-0.025em] uppercase [word-spacing:-0.08em]',
		reveal,
		className
	)}
>
	{@render children()}
</h2>
